'use client';

import {useState, useRef, useEffect} from 'react';
import {AiReportingAssistantInput, aiReportingAssistant} from '@/ai/flows/ai-reporting-assistant';
import {preSubmissionReview, PreSubmissionReviewInput} from '@/ai/flows/pre-submission-review';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {SpeechRecognitionService} from '@/services/speech-recognition';
import {Icons} from '@/components/icons';

const VoiceInput = ({onResult}: { onResult: (transcript: string) => void }) => {
  const [isListening, setIsListening] = useState(false);
  const [recognitionRef, setRecognitionRef] = useState<SpeechRecognitionService | null>(null);

  useEffect(() => {
    const recognitionService = new SpeechRecognitionService();
    setRecognitionRef(recognitionService);

    recognitionService.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
      setIsListening(false);
    };

    recognitionService.onstart = () => {
      setIsListening(true);
    };

    recognitionService.onend = () => {
      setIsListening(false);
    };

    recognitionService.onerror = (event) => {
      // Handle specific errors more gracefully
      if (event.error === 'no-speech') {
        console.warn('No speech detected.');
      } else if (event.error === 'aborted') {
        console.warn('Speech recognition aborted.');
      } else {
        console.error('Speech recognition error:', event.error);
      }
      setIsListening(false);
    };

    return () => {
      recognitionService.abort();
    };
  }, [onResult]);

  const toggleListening = () => {
    if (!recognitionRef) return;

    if (isListening) {
      recognitionRef?.stop();
    } else {
      try {
        recognitionRef?.start();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        setIsListening(false);
      }
    }
  };

  return (
    <Button
      variant="outline"
      onClick={toggleListening}
      disabled={!recognitionRef}
    >
      {isListening ? (
        <>
          <Icons.spinner className="mr-2 h-4 w-4 animate-spin"/>
          Listening...
        </>
      ) : (
        <>
          <Icons.mic className="mr-2 h-4 w-4"/>
          Start Voice Input
        </>
      )}
    </Button>
  );
};

export default function Home() {
  const [userInput, setUserInput] = useState('');
  const [conversationHistory, setConversationHistory] = useState<AiReportingAssistantInput['conversationHistory']>([]);
  const [aiResponse, setAiResponse] = useState('');
  const [reportSummary, setReportSummary] = useState('');
  const [isVoiceInputEnabled, setIsVoiceInputEnabled] = useState(true);

  const handleSendMessage = async () => {
    if (!userInput) return;

    const input: AiReportingAssistantInput = {
      userInput: userInput,
      conversationHistory: conversationHistory,
    };

    const aiResult = await aiReportingAssistant(input);

    setAiResponse(aiResult.response);
    setConversationHistory(aiResult.updatedConversationHistory);
    setUserInput(''); // Clear the input after sending
  };

  const handleVoiceInputResult = (transcript: string) => {
    setUserInput(transcript);
  };

  const handlePreSubmissionReview = async () => {
    if (!conversationHistory || conversationHistory.length === 0) {
      alert('No conversation history available for review.');
      return;
    }

    // Extract the conversation text for pre-submission review
    const conversationText = conversationHistory
      .map((message) => `${message.role}: ${message.content}`)
      .join('\n');

    const reviewInput: PreSubmissionReviewInput = {
      reportDraft: conversationText,
    };

    const reviewResult = await preSubmissionReview(reviewInput);
    setReportSummary(JSON.stringify(reviewResult, null, 2)); // Format the JSON for readability
  };

  const handleSubmitReport = () => {
    // Implement your report submission logic here
    alert('Report submitted!');
  };

  return (
    <div className="flex flex-col min-h-screen bg-secondary p-4">
      <Card className="flex-grow flex flex-col">
        <CardHeader>
          <CardTitle>MedWatch AI Assistant</CardTitle>
          <CardDescription>
            A conversational AI tool to guide you through the adverse event reporting process.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow overflow-y-auto">
          {conversationHistory?.map((message, index) => (
            <div key={index} className={`mb-2 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
              <span className="font-bold">{message.role === 'user' ? 'You:' : 'AI Assistant:'}</span>
              <p className="inline-block bg-muted rounded-lg p-2">{message.content}</p>
            </div>
          ))}
          {aiResponse && (
            <div className="text-left mb-2">
              <span className="font-bold">AI Assistant:</span>
              <p className="inline-block bg-muted rounded-lg p-2">{aiResponse}</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex items-center">
          <Input
            type="text"
            placeholder="Enter your message..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            className="mr-2"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSendMessage();
              }
            }}
          />
          <VoiceInput onResult={handleVoiceInputResult}/>
          <Button onClick={handleSendMessage}>Send</Button>
        </CardFooter>
      </Card>

      {reportSummary && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Report Summary</CardTitle>
            <CardDescription>Review the summary and edit if needed before submitting.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={reportSummary}
              onChange={(e) => setReportSummary(e.target.value)}
              className="mb-2"
            />
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={handlePreSubmissionReview}>Re-Review</Button>
            <Button onClick={handleSubmitReport}>Submit Report</Button>
          </CardFooter>
        </Card>
      )}

      {!reportSummary && (
        <div className="flex justify-center mt-4">
          <Button onClick={handlePreSubmissionReview}>Generate Report Summary</Button>
        </div>
      )}
      {/* Add footer for security information and FDA link */}
      <footer className="mt-8 text-center text-muted-foreground">
        <p>
          This tool uses AI to assist with adverse event reporting. Ensure all information is accurate before submitting.
        </p>
        <p>
          For more information about MedWatch, visit the <a href="https://www.fda.gov/safety/medwatch-fda-safety-information-and-adverse-event-reporting-program"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            FDA MedWatch website
          </a>.
        </p>
        <p>
          Your data is securely stored using Supabase, ensuring data privacy and compliance with relevant regulations.
        </p>
      </footer>
    </div>
  );
}
