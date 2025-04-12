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
  "What kind of problem did you experience? (Were you hurt or did you have a bad side effect? Did you use a product incorrectly? Did you notice a quality issue with the product? Did the problem occur after switching from one product maker to another?)",
  "What was the outcome of the problem? (Check all that apply) - Hospitalization (Admitted or stayed longer), Required help to prevent permanent harm, Disability or long-term health problem, Birth defect, Life-threatening event, Death (Please enter date), Other serious/important incident (Please describe)",
  "What date did the problem occur?",
  "Describe what happened, how it happened, and why you think it happened. (Encourage details)",
  "Were there any relevant lab tests or medical results? If yes, what were they and when were they done?",

  // Section B: Product Availability
  "Do you still have the product? (Yes/No)",
  "Do you have a picture of the product? (Yes/No)",

  // Section C: About the Product (Only if it's NOT a medical device)
  "What type of product is this? (Medicine / Cosmetic / Dietary Supplement / Food / Other)",
  "What is the name of the product (as shown on packaging)?",
  "Is the therapy still ongoing?",
  "Who is the manufacturer or company that makes the product?",
  "What type of product is it? (Select all that apply) - Over-the-Counter, Compounded, Generic, Biosimilar",
  "Expiration date of the product?",
  "Lot number?",
  "NDC (National Drug Code) number?",
  "Strength of the product (e.g., 800mg)?",
  "Quantity used each time (e.g., 2 pills, 1 teaspoon)?",
  "How frequently was it taken? (e.g., twice a day)",
  "How was the product used? (e.g., orally, injection, on skin)",
  "When did the person start using the product?",
  "When did the person stop using the product?",
  "Was the dosage ever reduced? When?",
  "Approximate duration of use?",
  "What was the product being used to treat?",
  "Did the problem stop when the product was reduced or stopped? (Yes/No)",
  "Did the problem return if the product was used again? (Yes/No/Didn’t restart)",

  // Section D: About the Medical Device (Only if the product is a medical device)
  "Name of the medical device?",
  "Manufacturer of the device?",
  "Lot number?",
  "NDC (National Drug Code) number?",
  "Lot number?",
  "Serial number?",
  "UDI (Unique Device Identifier) number?",
  "Expiration date?",
  "Was someone using the device when the problem occurred?",
  "For implants: When was the device implanted? Was it removed? When?",

  // Section E: About the Person Who Had the Problem
  "Person’s initials?",
  "Sex at birth? (Male/Female/Undifferentiated/Prefer not to say)",
  "Gender identity?",
  "Age (and unit: years/months/days)?",
  "Date of birth?",
  "Weight (in lb/kg)?",
  "Ethnicity? (Hispanic/Latino or Not)",
  "Race? (Select all that apply)",
  "List any known medical conditions (e.g., diabetes, cancer)",
  "List any allergies (e.g., to drugs, food, pollen)",
  "Other important info (e.g., pregnancy, tobacco, alcohol)",
  "List all current prescription medications and medical devices",
  "List all over-the-counter meds, supplements, herbs, vitamins",

  // Section F: About the Person Submitting the Report
  "Your name (first and last)?",
  "Your address (street, city, state, ZIP, country)?",
  "Your phone number?",
  "Your email address?",
  "Today’s date?",
  "Did you report the problem to the product’s manufacturer? (Yes/No)",
  "Do you want to stay anonymous from the manufacturer? (Yes/No)",
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
    }),
  },
  prompt: `Correct the spelling in the following text, and provide a summary of the user's intent in relation to the question being asked.

  Question: {{{currentQuestion}}}

  Text: {{{text}}}

  Output the corrected text and a summary of the user's intent.`,
});

async function spellCheckAndUnderstand(text: string, currentQuestion: string): Promise<{correctedText: string, intentSummary: string}> {
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

  // Determine if the conversation history suggests a medication issue
  const medicationMentioned = conversationHistory.some(message =>
    message.content.toLowerCase().includes('pill') ||
    message.content.toLowerCase().includes('syrup') ||
    message.content.toLowerCase().includes('injection')
  );
  let skipSectionD = false;
  let askSectionC = false;

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
    const {correctedText} = await spellCheckAndUnderstand(trimmedUserInput, currentQuestion);

    // Respond to the user's input to the current question
    response = `Okay, I have recorded: ${correctedText}. `;

    // Update report data with the user's input
    updatedReportData[`question_${currentQuestionIndex}`] = correctedText;

    // Move to the next question
    nextQuestionIndex = currentQuestionIndex + 1;

    // Skip Section D if necessary
    if (medicationMentioned && nextQuestionIndex >= 27 && nextQuestionIndex <= 36) {
      nextQuestionIndex = 37; // Jump to Section E
    }
    else if (skipSectionD && nextQuestionIndex >= 27 && nextQuestionIndex <= 36) {
      nextQuestionIndex = 37; // Jump to Section E
    }

    // Skip Section C if medical device is mentioned
    if (!medicationMentioned && askSectionC && nextQuestionIndex >= 8 && nextQuestionIndex <= 26) {
      // Skip Section C
      nextQuestionIndex = 27; // Jump to Section D
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
