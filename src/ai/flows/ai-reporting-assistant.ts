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
});

export type AiReportingAssistantInput = z.infer<typeof AiReportingAssistantInputSchema>;

const AiReportingAssistantOutputSchema = z.object({
  response: z.string().describe('The AI assistant response.'),
  updatedConversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).describe('The updated conversation history.'),
});

export type AiReportingAssistantOutput = z.infer<typeof AiReportingAssistantOutputSchema>;

export async function aiReportingAssistant(input: AiReportingAssistantInput): Promise<AiReportingAssistantOutput> {
  return aiReportingAssistantFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiReportingAssistantPrompt',
  input: {
    schema: z.object({
      userInput: z.string().describe('The user input for the conversation.'),
      conversationHistory: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })).optional().describe('The conversation history.'),
    }),
  },
  output: {
    schema: z.object({
      response: z.string().describe('The AI assistant response.'),
    }),
  },
  prompt: `You are an AI assistant designed to guide users through the adverse event reporting process for the FDA's MedWatch program.

  Your goal is to ask relevant questions and clarify user responses to efficiently and accurately collect information for the report.  Maintain a conversational tone.

  Here's the user's input: {{{userInput}}}

  Here's the conversation history:
  {{conversationHistory}}

  Based on the user's input and the conversation history, respond appropriately. If this is the start of a new conversation, begin by asking the user what product they were using.
  If the user provides an unclear response, ask follow-up questions to get more details.
  Ensure all critical fields are addressed before submission.
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
  const {userInput, conversationHistory = []} = input;
  // Trim whitespace from the user input to handle voice input effectively
  const trimmedUserInput = userInput.trim();

  // Format conversation history
  const formattedConversationHistory = conversationHistory
    .map(message => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`)
    .join('\n');

  const {output} = await prompt({
    userInput: trimmedUserInput,
    conversationHistory: formattedConversationHistory,
  });

  const newAssistantMessage = {
    role: 'assistant',
    content: output!.response,
  };

  const updatedConversationHistory = [
    ...(conversationHistory || []),
    {role: 'user', content: trimmedUserInput},
    newAssistantMessage,
  ];

  return {
    response: output!.response,
    updatedConversationHistory: updatedConversationHistory,
  };
});
