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
  "What type of product is this? (Cosmetic / Dietary Supplement / Food / Other)",
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
  "Model number?",
  "Catalog number?",
  "Lot number?",
  "Serial number?",
  "UDI (Unique Device Identifier) number?",
  "Expiration date?",
  "Was someone using the device when the problem occurred? If yes, who was using it? (Patient / Healthcare provider / Other)",
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

const prompt = ai.definePrompt({
  name: 'aiReportingAssistantPrompt',
  input: {
    schema: z.object({
      userInput: z.string().describe('The user input for the conversation.'),
      conversationHistory: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })).optional().describe('The conversation history.'),
      currentQuestionIndex: z.number().optional().describe('The index of the current question being asked.'),
      reportData: z.record(z.any()).optional().describe('Data collected so far for the report.'),
    }),
  },
  output: {
    schema: z.object({
      response: z.string().describe('The AI assistant response.'),
      nextQuestionIndex: z.number().optional().describe('The index of the next question to be asked.'),
      isEndOfQuestions: z.boolean().optional().describe('Indicates that all questions have been asked.'),
    }),
  },
  prompt: `You are an AI assistant designed to guide users through the adverse event reporting process for the FDA's MedWatch program.

  Your goal is to ask relevant questions and clarify user responses to efficiently and accurately collect information for the report.  Maintain a conversational tone.

  Here's the user's input: {{{userInput}}}
  
  Current question index: {{{currentQuestionIndex}}}

  Here's the conversation history:
  {{conversationHistory}}

  Based on the user's input, current question, and the conversation history, respond appropriately.
  If this is the start of a new conversation (currentQuestionIndex is not defined), begin by asking the first question from the list.
  If the user provides an unclear response, ask follow-up questions to get more details.
  Once a question is answered, move to the next question in the list.
  If all questions have been asked, summarize the information collected and ask the user if they would like to review the report.
  Remember to maintain HIPAA compliance.
  `,
});

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

  // Format conversation history
  const formattedConversationHistory = conversationHistory
    .map(message => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`)
    .join('\n');

  let nextQuestionIndex = currentQuestionIndex;
  let response = '';
  let isEndOfQuestions = false;
  let updatedReportData = {...reportData};

  // Check if we should skip Section D
  let skipSectionD = false;
  if (reportData['question_7'] && typeof reportData['question_7'] === 'string') {
    const productType = reportData['question_7'].toLowerCase();
    skipSectionD = productType.includes('pill') || productType.includes('syrup') || productType.includes('injection');
  }

  if (conversationHistory.length === 0) {
    // If it's a new conversation, start with the first question.
    response = feedbackQuestions[0];
    nextQuestionIndex = 0; // Initialize currentQuestionIndex
  }
  else if (currentQuestionIndex < feedbackQuestions.length) {
    // Respond to the user's input to the current question
    response = `Okay, I have recorded: ${trimmedUserInput}. `;

    // Update report data with the user's input
    updatedReportData[`question_${currentQuestionIndex}`] = trimmedUserInput;

    // Move to the next question
    nextQuestionIndex = currentQuestionIndex + 1;

    // Skip Section D if necessary
    if (skipSectionD && nextQuestionIndex === 27) {
      nextQuestionIndex = 37; // Jump to Section E
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

  const {output} = await prompt({
    userInput: trimmedUserInput,
    conversationHistory: formattedConversationHistory,
    currentQuestionIndex: currentQuestionIndex,
    reportData: updatedReportData,
  });

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
