'use server';
/**
 * @fileOverview AI-Powered Pre-Submission Review Tool.
 *
 * - preSubmissionReview - A function that handles the pre-submission review process.
 * - PreSubmissionReviewInput - The input type for the preSubmissionReview function.
 * - PreSubmissionReviewOutput - The return type for the preSubmissionReview function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const PreSubmissionReviewInputSchema = z.object({
  reportDraft: z.string().describe('The report draft to be reviewed.'),
});
export type PreSubmissionReviewInput = z.infer<typeof PreSubmissionReviewInputSchema>;

const PreSubmissionReviewOutputSchema = z.object({
  consistencyCheck: z.string().describe('Checks for inconsistencies (e.g., dates don\'t make sense).'),
  completenessScore: z.string().describe('Assesses if critical information is missing.'),
  anonymizationCheck: z.string().describe('Helps ensure personally identifiable information isn\'t accidentally included.'),
  clarityAssessment: z.string().describe('Flags ambiguous descriptions and suggest clarification.'),
});
export type PreSubmissionReviewOutput = z.infer<typeof PreSubmissionReviewOutputSchema>;

export async function preSubmissionReview(input: PreSubmissionReviewInput): Promise<PreSubmissionReviewOutput> {
  return preSubmissionReviewFlow(input);
}

const preSubmissionReviewPrompt = ai.definePrompt({
  name: 'preSubmissionReviewPrompt',
  input: {
    schema: z.object({
      reportDraft: z.string().describe('The report draft to be reviewed.'),
    }),
  },
  output: {
    schema: z.object({
      consistencyCheck: z.string().describe('Checks for inconsistencies (e.g., dates don\'t make sense).'),
      completenessScore: z.string().describe('Assesses if critical information is missing.'),
      anonymizationCheck: z.string().describe('Helps ensure personally identifiable information isn\'t accidentally included.'),
      clarityAssessment: z.string().describe('Flags ambiguous descriptions and suggest clarification.'),
    }),
  },
  prompt: `You are an AI-powered tool that performs a pre-submission review of the report draft, checking for consistency, completeness, and potential privacy issues, before submission.\n\nReview the following report draft:\n\n{{{reportDraft}}}\n\nProvide feedback on the following aspects:\n- Consistency Checks: Look for inconsistencies (e.g., dates don\'t make sense).\n- Completeness Score/Prompts: Assess if critical information is missing (e.g., \"You haven\'t specified the outcome of the event. Was it resolved?\n- Anonymization Check (for patient data): Help ensure personally identifiable information (beyond what\'s required and consented to) isn\'t accidentally included in free-text fields.\n- Clarity Assessment: Flag ambiguous descriptions and suggest clarification.\n`,
});

const preSubmissionReviewFlow = ai.defineFlow<
  typeof PreSubmissionReviewInputSchema,
  typeof PreSubmissionReviewOutputSchema
>({
  name: 'preSubmissionReviewFlow',
  inputSchema: PreSubmissionReviewInputSchema,
  outputSchema: PreSubmissionReviewOutputSchema,
},
async input => {
  const {output} = await preSubmissionReviewPrompt(input);
  return output!;
});
