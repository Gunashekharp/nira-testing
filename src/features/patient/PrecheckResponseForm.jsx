import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, Send } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { Input, Textarea, Field } from "../../components/ui/FormFields";
import { Badge } from "../../components/ui/Badge";

export function PrecheckResponseForm({ questionnaire, onSubmit, isLoading }) {
  const initialResponses = questionnaire.patientResponses || questionnaire.patient_responses || {};
  const [responses, setResponses] = useState(initialResponses);
  const [errors, setErrors] = useState([]);
  const [submitted, setSubmitted] = useState(false);

  const questions = questionnaire.editedQuestions || questionnaire.edited_questions || questionnaire.aiQuestions || questionnaire.ai_questions || [];

  useEffect(() => {
    setResponses(questionnaire.patientResponses || questionnaire.patient_responses || {});
    setErrors([]);
    setSubmitted(questionnaire.status === "completed");
  }, [questionnaire]);

  const handleResponse = (questionId, value) => {
    setResponses({
      ...responses,
      [questionId]: value
    });
    // Clear error for this question when user starts typing
    setErrors(errors.filter((e) => e.questionId !== questionId));
  };

  const validateResponses = () => {
    const newErrors = [];

    questions.forEach((q) => {
      if (q.required && !responses[q.id]) {
        newErrors.push({
          questionId: q.id,
          message: "This question is required"
        });
      }
    });

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = async () => {
    if (validateResponses()) {
      try {
        await onSubmit(responses);
        setSubmitted(true);
      } catch (error) {
        console.error("Error submitting responses:", error);
      }
    }
  };

  if (submitted) {
    const sessionPairs = questions.map((question) => ({
      id: question.id,
      question: question.question,
      answer: responses[question.id] || "Not answered"
    }));

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="bg-emerald-50 border-b">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={20} className="text-emerald-600" />
                <h2 className="text-xl font-semibold text-text-primary">
                  Question & Answer session complete
                </h2>
              </div>
              <p className="text-sm text-text-secondary">
                Your pre-check answers are now packaged as a guided Q&A transcript for the doctor to review before the consultation.
              </p>

              <div className="flex items-center gap-3">
                <div className="flex-1 bg-emerald-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-emerald-600 h-full w-full" />
                </div>
                <span className="text-sm font-medium text-text-primary">
                  {sessionPairs.length} / {sessionPairs.length} answered
                </span>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Conversation transcript</h3>
                <p className="text-sm text-text-secondary">
                  Review the exact question-and-answer flow that will accompany your visit summary.
                </p>
              </div>
              <div className="text-xs font-medium uppercase tracking-wide text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                Ready for doctor review
              </div>
            </div>
          </CardHeader>
          <div className="space-y-3 p-4 pt-0">
            {sessionPairs.map((item, index) => (
              <div key={item.id} className="space-y-3 rounded-2xl border border-line bg-surface-2 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                    Q{index + 1}
                  </div>
                  <div className="flex-1 rounded-2xl rounded-tl-none bg-white px-4 py-3 text-sm text-text-primary shadow-sm">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600 mb-1">
                      Doctor question
                    </div>
                    {item.question}
                  </div>
                </div>

                <div className="flex items-start gap-3 justify-end">
                  <div className="flex-1 rounded-2xl rounded-tr-none bg-emerald-600 px-4 py-3 text-sm text-white shadow-sm sm:max-w-[85%]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-100 mb-1">
                      Your answer
                    </div>
                    {item.answer}
                  </div>
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                    A{index + 1}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-slate-500" />
              <h3 className="text-base font-semibold text-text-primary">What happens next</h3>
            </div>
          </CardHeader>
          <div className="px-4 pb-4 text-sm text-text-secondary">
            The doctor will see this transcript alongside the structured summary in the EMR, so the consult can start with context already in place.
          </div>
        </Card>
      </div>
    );
  }

  const requiredCount = questions.filter((q) => q.required).length;
  const answeredCount = Object.keys(responses).filter((id) => responses[id]).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="bg-blue-50 border-b">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock size={20} className="text-blue-600" />
              <h2 className="text-xl font-semibold text-text-primary">
                Pre-Check-Up Questions
              </h2>
            </div>
            <p className="text-sm text-text-secondary">
              Please answer the following questions before your appointment. This helps us provide better care and faster service.
            </p>

            {/* Progress */}
            <div className="flex items-center gap-3 mt-3">
              <div className="flex-1 bg-blue-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all"
                  style={{ width: `${requiredCount > 0 ? (answeredCount / requiredCount) * 100 : 0}%` }}
                />
              </div>
              <span className="text-sm font-medium text-text-primary">
                {answeredCount} / {requiredCount}
              </span>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0" />
          <div className="text-sm text-red-700">
            <p className="font-medium">Please answer all required questions:</p>
            <ul className="list-disc list-inside mt-1">
              {errors.map((err) => (
                <li key={err.questionId}>
                  {questions.find((q) => q.id === err.questionId)?.question}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Questions */}
      <div className="space-y-4">
        {questions.length === 0 ? (
          <Card>
            <CardHeader className="text-center py-6">
              <p className="text-text-secondary">No questions to answer at this time.</p>
            </CardHeader>
          </Card>
        ) : (
          questions.map((question, index) => (
            <QuestionItem
              key={question.id}
              index={index}
              question={question}
              value={responses[question.id] || ""}
              onChange={(value) => handleResponse(question.id, value)}
              hasError={errors.some((e) => e.questionId === question.id)}
            />
          ))
        )}
      </div>

      {/* Submit Button */}
      <div className="flex gap-3 pt-4 border-t">
        <Button
          variant="primary"
          size="lg"
          onClick={handleSubmit}
          isLoading={isLoading}
          disabled={questions.length === 0}
          className="gap-2 flex-1"
        >
          <Send size={16} /> Submit Answers
        </Button>
      </div>
    </div>
  );
}

/**
 * Individual Question Component
 */
function QuestionItem({ index, question, value, onChange, hasError }) {
  const isRequired = question.required;

  return (
    <Card className={hasError ? "border-red-200 bg-red-50" : ""}>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <label className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-text-primary">
                {index + 1}. {question.question}
              </span>
              {isRequired && (
                <span className="text-red-600 font-bold">*</span>
              )}
            </div>
          </label>
          {question.category && (
            <Badge variant="secondary" size="sm">
              {question.category}
            </Badge>
          )}
        </div>

        {/* Question Input Based on Type */}
        <div className="mt-2">
          {question.type === "text" && (
            <Textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Enter your answer..."
              rows={3}
              className={hasError ? "border-red-400" : ""}
            />
          )}

          {question.type === "yesno" && (
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={question.id}
                  value="yes"
                  checked={value === "yes"}
                  onChange={(e) => onChange(e.target.value)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-text-primary">Yes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={question.id}
                  value="no"
                  checked={value === "no"}
                  onChange={(e) => onChange(e.target.value)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-text-primary">No</span>
              </label>
            </div>
          )}

          {question.type === "multiple_choice" && question.options && (
            <div className="space-y-2">
              {question.options.map((option) => (
                <label key={option} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-surface-2 transition">
                  <input
                    type="radio"
                    name={question.id}
                    value={option}
                    checked={value === option}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-text-primary">{option}</span>
                </label>
              ))}
            </div>
          )}

          {question.type === "rating" && (
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                <button
                  key={num}
                  onClick={() => onChange(num)}
                  className={`w-10 h-10 rounded-lg border-2 font-medium transition ${
                    value === num
                      ? "bg-brand text-white border-brand"
                      : "border-line bg-surface-2 text-text-primary hover:border-brand"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error Message */}
        {hasError && (
          <div className="text-sm text-red-600 flex items-center gap-1 mt-2">
            <AlertCircle size={14} />
            This question is required
          </div>
        )}
      </CardHeader>
    </Card>
  );
}
