'use server';
/**
 * @fileOverview A conversational AI assistant for adverse event reporting.
 *
 * - aiReportingAssistant - A function that initiates the adverse event reporting process.
 * - AiReportingAssistantInput - The input type for the aiReportingAssistant function.
 * - AiReportingAssistantOutput - The return type for the aiReportingAssistant function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const AiReportingAssistantInputSchema = z.object({
  userInput: z.string().describe('The user input for the conversation.'),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional().describe('The conversation history.'),
  currentQuestionIndex: z.number().optional().describe('The index of the current question being asked.'),
  reportData: z.record(z.any()).optional().describe('Data collected so far for the report.'),
  imageUpload: z.string().optional().describe('Uploaded image as a base64 encoded string.'),
});

export type AiReportingAssistantInput = z.infer<typeof AiReportingAssistantInputSchema>;

const AiReportingAssistantOutputSchema = z.object({
  response: z.string().describe('The AI assistant response.'),
  updatedConversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).describe('The updated conversation history.'),
  nextQuestionIndex: z.number().optional().describe('The index of the next question to be asked.'),
  reportData: z.record(z.any()).optional().describe('Updated data collected for the report.'),
  isEndOfQuestions: z.boolean().optional().describe('Indicates that all questions have been asked.'),
});

export type AiReportingAssistantOutput = z.infer<typeof AiReportingAssistantOutputSchema>;

export async function aiReportingAssistant(input: AiReportingAssistantInput): Promise<AiReportingAssistantOutput> {
  return aiReportingAssistantFlow(input);
}

const feedbackQuestions = [
  // Section A: About the Problem
  "What kind of problem did you experience?\n • Were you hurt or did you have a bad side effect?\n • Did you use a product incorrectly?\n • Did you notice a quality issue with the product?\n • Did the problem occur after switching from one product maker to another?", //0
  "What was the outcome of the problem? (Check all that apply)\n • Hospitalization (Admitted or stayed longer)\n • Required help to prevent permanent harm\n • Disability or long-term health problem\n • Birth defect\n • Life-threatening event\n • Death (Include date)\n • Other serious/important incidents (Please describe)", //1
  "What date did the problem occur?", //2
  "Describe what happened, how it happened, and why you think it happened. (Include as many details as possible. FDA may reach out to you for any additional documents if necessary)", //3
  "Were there any relevant lab tests or lab results? (Mention all the lab tests, lab results and dates performed)", //4

  // Section B: Product Availability
  "Do you still have the product in case we need to evaluate it? (Do not send the product to FDA. We will contact you directly if we need it.) (Yes/No)", //5
  "Do you have a picture of the product? (Yes/No)", //6

  // Section C: About the Product (Only if it's NOT a medical device)
  "What type of product is this? (Medicine / Cosmetic / Dietary Supplement / Food / Medical Device, Other)", //7
  "What is the name of the product (as shown on packaging)?", //8
  "Is the therapy still ongoing?", //9
  "Who is the manufacturer or company that makes the product?", //10
  "What type of product is it? (Select all that apply)\n  • Over-the-Counter\n  • Compounded\n  • Generic\n  • Biosimilar", //11
  "Expiration date of the product?", //12
  "Lot number?", //13
  "NDC (National Drug Code) number?", //14
  "Strength of the product (e.g., 800mg)?", //15
  "Quantity used each time (e.g., 2 pills, 1 teaspoon)?", //16
  "How frequently was it taken? (e.g., twice a day)", //17
  "How was the product used? (e.g., orally, injection, on skin)", //18
  "When did the person start using the product?", //19
  "When did the person stop using the product?", //20
  "Was the dosage ever reduced? When?", //21
  "Approximate duration of use?", //22
  "What was the product being used to treat?", //23
  "Did the problem stop when the product was reduced or stopped? (Yes/No)", //24
  "Did the problem return if the product was used again? (Yes/No/Didn’t restart)", //25

  // Section D: About the Medical Device (Only if the product is a medical device)
  "Name of the medical device?", //26
  "Manufacturer of the device?", //27
  "Model number?", //28
  "Catalog number?", //29
  "Lot number?", //30
  "Serial number?", //31
  "UDI (Unique Device Identifier) number?", //32
  "Expiration date?", //33
  "Was someone using the device when the problem occurred? If yes, who was using it? (Patient / Healthcare provider / Other)", //34
  "For implants:\n • When was the device implanted?\n • Was it removed? When?", //35

  // Section E: About the Person Who Had the Problem
  "Person’s initials?", //36
  "Sex at birth? (Male/Female/Undifferentiated/Prefer not to say)", //37
  "Gender identity? (List options)", //38
  "Age (and unit: years/months/days)?", //39
  "Date of birth?", //40
  "Weight (in lb/kg)?", //41
  "Ethnicity? (Hispanic/Latino or Not)", //42
  "Race? (Select all that apply)", //43
  "List any known medical conditions (e.g., diabetes, cancer)", //44
  "List any allergies (e.g., to drugs, food, pollen)", //45
  "Other important info (e.g., pregnancy, tobacco, alcohol)", //46
  "List all current prescription medications and medical devices", //47
  "List all over-the-counter meds, supplements, herbs, vitamins", //48

  // Section F: About the Person Submitting the Report
  "Your name (first and last)?", //49
  "Your address (street, city, state, ZIP, country)?", //50
  "Your phone number?", //51
  "Your email address?", //52
  "Today’s date?", //53
  "Did you report the problem to the product’s manufacturer? (Yes/No)", //54
  "Do you want to stay anonymous from the manufacturer? (Yes/No)", //55
];

const spellCheckAndUnderstandPrompt = ai.definePrompt({
  name: 'spellCheckAndUnderstandPrompt',
  input: {
    schema: z.object({
      text: z.string().describe('The user input text that may contain spelling errors.'),
      currentQuestion: z.string().describe('The current question being asked to the user.'),
    }),
  },
  output: {
    schema: z.object({
      correctedText: z.string().describe('The user input text with spelling corrected.'),
      intentSummary: z.string().describe('A brief summary of the user\'s intent based on their response.'),
      productType: z.string().optional().describe('The product type mentioned by the user (e.g., medicine, medical device).')
    }),
  },
  prompt: `Correct the spelling in the following text, and provide a summary of the user's intent in relation to the question being asked.
Also, determine if the user is talking about a medication, medical device, or neither, by summarizing the type of the product in relation to the question being asked.

  Question: {{{currentQuestion}}}

  Text: {{{text}}}

  Output the corrected text, a summary of the user's intent, and the type of product mentioned, if any.`,
});

async function spellCheckAndUnderstand(text: string, currentQuestion: string): Promise<{correctedText: string, intentSummary: string, productType?: string}> {
  const {output} = await spellCheckAndUnderstandPrompt({
    text: text,
    currentQuestion: currentQuestion,
  });
  return output!;
}

const aiReportingAssistantFlow = ai.defineFlow<
  typeof AiReportingAssistantInputSchema,
  typeof AiReportingAssistantOutputSchema
>({
  name: 'aiReportingAssistantFlow',
  inputSchema: AiReportingAssistantInputSchema,
  outputSchema: AiReportingAssistantOutputSchema,
}, async input => {
  const {userInput, conversationHistory = [], currentQuestionIndex = 0, reportData = {}} = input;
  // Trim whitespace from the user input to handle voice input effectively
  const trimmedUserInput = userInput.trim();

  let nextQuestionIndex = currentQuestionIndex;
  let response = '';
  let isEndOfQuestions = false;
  let updatedReportData = {...reportData};
  let skipSectionD = false;
  let askSectionC = false;

  //Determine if the product is a medical device.
  if (reportData['question_7'] && typeof reportData['question_7'] === 'string') {
    const productType = reportData['question_7'].toLowerCase();
    skipSectionD = productType.includes('cosmetic') || productType.includes('dietary supplement') || productType.includes('food') || productType.includes('other');
    askSectionC = !skipSectionD;
  }
  if (conversationHistory.length === 0) {
    // If it's a new conversation, start with the first question.
    response = feedbackQuestions[0];
    nextQuestionIndex = 0; // Initialize currentQuestionIndex
  }
  else if (currentQuestionIndex < feedbackQuestions.length) {
    // Autocorrect the spelling in the user's input
    const currentQuestion = feedbackQuestions[currentQuestionIndex];
    const {correctedText, productType} = await spellCheckAndUnderstand(trimmedUserInput, currentQuestion);

    // Respond to the user's input to the current question
    response = `Okay, I have recorded: ${correctedText.replace(/\.+$/, '')}. `;

    // Update report data with the user's input
    updatedReportData[`question_${currentQuestionIndex}`] = correctedText;

    // Move to the next question
    nextQuestionIndex = currentQuestionIndex + 1;

    // Determine if the product is a medical device or medication based on reportData and conversationHistory
    let isMedicalDevice = false;
    let isMedication = false;

    if (reportData['question_7'] && typeof reportData['question_7'] === 'string') {
      const productType = reportData['question_7'].toLowerCase();
      isMedicalDevice = productType.includes('medical device');
      isMedication = productType.includes('medicine') || productType.includes('prescription') || productType.includes('over-the-counter');
    } else {
      // If question 7 hasn't been answered yet, check the conversation history for mentions of medical devices or medication
      const lastUserInput = conversationHistory.length > 0 ? conversationHistory[conversationHistory.length - 1].content.toLowerCase() : '';
      isMedicalDevice = lastUserInput.includes('medical device') || lastUserInput.includes('device');
      isMedication = lastUserInput.includes('medicine') || lastUserInput.includes('medication') || lastUserInput.includes('pill') || lastUserInput.includes('syrup') || lastUserInput.includes('injection');
    }

    // Skip Section D if necessary
    if (isMedication && nextQuestionIndex >= 27 && nextQuestionIndex <= 35) {
      nextQuestionIndex = 36; // Jump to Section E
      console.log('Skipping to section E: ', nextQuestionIndex);
    }
    else if (skipSectionD && nextQuestionIndex >= 27 && nextQuestionIndex <= 35) {
      nextQuestionIndex = 36; // Jump to Section E
      console.log('Skipping to section E: ', nextQuestionIndex);
    }

    // Skip Section C if medical device is mentioned
    if (isMedicalDevice && askSectionC && nextQuestionIndex >= 8 && nextQuestionIndex <= 26) {
      // Skip Section C
      nextQuestionIndex = 27; // Jump to Section D
      console.log('Skipping to section D: ', nextQuestionIndex);
    }

    if (nextQuestionIndex < feedbackQuestions.length) {
      response += feedbackQuestions[nextQuestionIndex]; // Ask the next question
    } else {
      response += "Thank you! All questions have been answered.  Would you like me to summarize the report?";
      isEndOfQuestions = true;
    }
  } else {
    response = "Thank you! All questions have been answered.  Would you like me to summarize the report?";
    isEndOfQuestions = true;
  }

  const newAssistantMessage = {
    role: 'assistant',
    content: response,
  };

  const updatedConversationHistory = [
    ...(conversationHistory || []),
    {role: 'user', content: trimmedUserInput},
    newAssistantMessage,
  ];

  return {
    response: response,
    updatedConversationHistory: updatedConversationHistory,
    nextQuestionIndex: nextQuestionIndex,
    reportData: updatedReportData,
    isEndOfQuestions: isEndOfQuestions,
  };
});
