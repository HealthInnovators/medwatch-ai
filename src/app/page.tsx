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
import {useToast} from "@/hooks/use-toast";
import {useSupabaseClient} from '@supabase/auth-helpers-react';
import {v4 as uuidv4} from 'uuid';
import {useRouter} from 'next/navigation';

const VoiceInput = ({onResult}: { onResult: (transcript: string) => void }) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionService | null>(null);

  useEffect(() => {
    let recognitionService: SpeechRecognitionService | null = null;
    try {
      recognitionService = new SpeechRecognitionService();
      recognitionRef.current = recognitionService;

      recognitionService.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        onResult(transcript);
      };

      recognitionService.onstart = () => {
        setIsListening(true);
      };

      recognitionService.onend = () => {
        setIsListening(false);
      };

      recognitionService.onerror = (event) => {
        if (event.error === 'aborted') {
          // Do not treat "aborted" as a general error. It happens normally when the user pauses.
          console.log('Speech recognition aborted.');
          setIsListening(false);
          return;
        }
        console.error('Speech recognition error:', event);
        setIsListening(false);
      };
    } catch (error) {
      console.error('Error initializing SpeechRecognitionService:', error);
      setIsListening(false);
    }

    return () => {
      recognitionService?.abort();
    };
  }, [onResult]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      try {
        recognitionRef.current?.start();
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
      disabled={!recognitionRef.current}
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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [reportData, setReportData] = useState({});
  const [isEndOfQuestions, setIsEndOfQuestions] = useState(false);
  const {toast} = useToast();
  const supabase = useSupabaseClient();
  const router = useRouter();

  const handleSendMessage = async () => {
    if (!userInput) return;

    const input: AiReportingAssistantInput = {
      userInput: userInput,
      conversationHistory: conversationHistory,
      currentQuestionIndex: currentQuestionIndex,
      reportData: reportData,
    };

    const aiResult = await aiReportingAssistant(input);

    setConversationHistory(aiResult.updatedConversationHistory);
    setAiResponse(aiResult.response);
    setUserInput(''); // Clear the input after sending
    setCurrentQuestionIndex(aiResult.nextQuestionIndex || 0);
    setReportData(aiResult.reportData || {});
    setIsEndOfQuestions(aiResult.isEndOfQuestions || false);
  };

  const handleVoiceInputResult = async (transcript: string) => {
    setUserInput((prevInput) => prevInput + transcript);
  };

  const formatReportSummary = (reviewResult: any) => {
    let formattedSummary = '';
    for (const key in reviewResult) {
      if (reviewResult.hasOwnProperty(key)) {
        formattedSummary += `${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:\n`; // Add title
        formattedSummary += `${reviewResult[key]}\n\n`; // Add feedback and double line break for separation
      }
    }
    return formattedSummary;
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
    setReportSummary(formatReportSummary(reviewResult));
  };

  const handleSubmitReport = async () => {
    const reportId = uuidv4();
    const conversationText = conversationHistory
      .map((message) => `${message.role}: ${message.content}`)
      .join('\n');

    const {data, error} = await supabase
      .from('reports')
      .insert([
        {
          id: reportId,
          report_data: conversationText,
          report_summary: reportSummary,
        },
      ]);

    if (error) {
      toast({
        title: 'Error submitting report',
        description: 'There was an error submitting your report. Please try again.',
        variant: 'destructive',
      });
      console.error('Error submitting report:', error);
    } else {
      toast({
        title: 'Report submitted',
        description: 'Your report has been submitted successfully.',
      });
      // Redirect to a confirmation page or clear the form
      router.refresh(); // Refresh the route to clear the form
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-secondary p-4">
      <Card className="flex-grow flex flex-col">
        <CardHeader>
          <CardTitle>MedWatch AI Assistant</CardTitle>
          <CardDescription>
            A conversational AI tool to guide you through the adverse event reporting process.
            <br/>
            To get started, type your response in the input box or use the voice input feature.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow overflow-y-auto">
          {conversationHistory?.map((message, index) => (
            <div key={index} className={`mb-2 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
              <span className="font-bold">{message.role === 'user' ? 'You:' : 'AI Assistant:'}</span>
              <p className="inline-block bg-muted rounded-lg p-2">{message.content}</p>
            </div>
          ))}
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
          <div className="ml-2 mr-2">
            <VoiceInput onResult={handleVoiceInputResult}/>
          </div>
          <Button className="ml-2" onClick={handleSendMessage}>Send</Button>
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

      {!reportSummary && isEndOfQuestions && (
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



