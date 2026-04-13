import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Edit2, Plus, Trash2, X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Card, CardHeader } from "../../components/ui/Card";
import { Input, Textarea, Field } from "../../components/ui/FormFields";
import { Badge } from "../../components/ui/Badge";
import "./PrecheckQuestionsModal.css";

export function PrecheckQuestionsModal({ isOpen, onClose, questions, onConfirm, isLoading }) {
  const [editedQuestions, setEditedQuestions] = useState(questions || []);
  const [editingIndex, setEditingIndex] = useState(null);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    setEditedQuestions(questions || []);
    setEditingIndex(null);
    setErrors([]);
  }, [isOpen, questions]);

  // ── Editing handlers ──

  const handleEditQuestion = (index) => {
    setEditingIndex(index);
  };

  const handleSaveQuestion = (index, updatedQuestion) => {
    const updated = [...editedQuestions];
    updated[index] = updatedQuestion;
    setEditedQuestions(updated);
    setEditingIndex(null);
    setErrors([]);
  };

  const handleDeleteQuestion = (index) => {
    const updated = editedQuestions.filter((_, i) => i !== index);
    setEditedQuestions(updated);
  };

  const handleAddQuestion = () => {
    const newQuestion = {
      id: `q_${Date.now()}`,
      question: "",
      type: "text",
      required: true,
      category: "general"
    };
    setEditedQuestions([...editedQuestions, newQuestion]);
    setEditingIndex(editedQuestions.length);
  };

  // ── Validation ──

  const validateQuestions = () => {
    const newErrors = [];

    editedQuestions.forEach((q, idx) => {
      if (!q.question || !q.question.trim()) {
        newErrors.push({ index: idx, message: "Question text is required" });
      }
      if (!q.type) {
        newErrors.push({ index: idx, message: "Question type is required" });
      }
    });

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleConfirm = () => {
    if (validateQuestions()) {
      onConfirm(editedQuestions);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <div className="flex flex-col h-full gap-4">
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">Pre-Check-Up Questions</h2>
            <p className="text-sm text-text-secondary mt-1">
              Review AI-generated questions, edit as needed, then send to patient
            </p>
          </div>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        {/* ── Validation Errors ── */}
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-3">
            <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">
              <p className="font-medium">Please fix the following errors:</p>
              <ul className="list-disc list-inside mt-1">
                {errors.map((err, i) => (
                  <li key={i}>
                    Q{err.index + 1}: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ── Question List ── */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {editedQuestions.length === 0 ? (
            <div className="text-center py-8 text-text-secondary">
              <p>No questions added yet</p>
            </div>
          ) : (
            editedQuestions.map((question, index) => (
              <div key={question.id} className="border border-line rounded-lg p-4 bg-surface-2">
                {editingIndex === index ? (
                  <QuestionEditor
                    question={question}
                    onSave={(updated) => handleSaveQuestion(index, updated)}
                    onCancel={() => setEditingIndex(null)}
                  />
                ) : (
                  <QuestionPreview
                    index={index}
                    question={question}
                    onEdit={() => handleEditQuestion(index)}
                    onDelete={() => handleDeleteQuestion(index)}
                  />
                )}
              </div>
            ))
          )}
        </div>

        {/* ── Add Question Button ── */}
        <div className="border-t pt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAddQuestion}
            className="gap-2 w-full"
            disabled={isLoading}
          >
            <Plus size={16} /> Add Question
          </Button>
        </div>

        {/* ── Action Buttons ── */}
        <div className="flex gap-3 border-t pt-4">
          <Button
            variant="neutral"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            isLoading={isLoading}
            className="gap-2"
          >
            <CheckCircle2 size={16} /> Confirm & Send to Patient
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Question Preview Component (Read-only display)
 */
function QuestionPreview({ index, question, onEdit, onDelete }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="font-medium text-text-primary">
            Q{index + 1}: {question.question}
          </p>
          <div className="flex gap-2 mt-2 flex-wrap">
            <Badge variant="neutral" size="sm">
              {question.type}
            </Badge>
            {question.required && (
              <Badge variant="danger" size="sm">
                Required
              </Badge>
            )}
            <Badge variant="secondary" size="sm">
              {question.category}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="p-2 text-brand hover:bg-surface-3 rounded-lg transition"
            title="Edit"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {question.options && question.options.length > 0 && (
        <div className="bg-surface-1 rounded p-2 mt-2">
          <p className="text-xs text-text-secondary mb-1">Options:</p>
          <ul className="space-y-1">
            {question.options.map((option, i) => (
              <li key={i} className="text-sm text-text-primary">
                • {option}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Question Editor Component (Edit mode)
 */
function QuestionEditor({ question, onSave, onCancel }) {
  const [form, setForm] = useState(question);
  const [newOption, setNewOption] = useState("");

  const handleAddOption = () => {
    if (newOption.trim()) {
      setForm({
        ...form,
        options: [...(form.options || []), newOption]
      });
      setNewOption("");
    }
  };

  const handleRemoveOption = (index) => {
    const options = form.options?.filter((_, i) => i !== index) || [];
    setForm({ ...form, options });
  };

  return (
    <div className="space-y-3">
      {/* Question Text */}
      <Field label="Question">
        <Textarea
          value={form.question}
          onChange={(e) => setForm({ ...form, question: e.target.value })}
          placeholder="Enter question..."
          rows={2}
        />
      </Field>

      {/* Question Type */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full px-3 py-2 border border-line rounded-lg bg-surface-2 text-text-primary"
          >
            <option value="text">Text</option>
            <option value="yesno">Yes/No</option>
            <option value="multiple_choice">Multiple Choice</option>
            <option value="rating">Rating Scale</option>
          </select>
        </Field>

        <Field label="Category">
          <select
            value={form.category || "general"}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full px-3 py-2 border border-line rounded-lg bg-surface-2 text-text-primary"
          >
            <option value="general">General</option>
            <option value="symptoms">Symptoms</option>
            <option value="medications">Medications</option>
            <option value="vital_history">Medical History</option>
            <option value="allergies">Allergies</option>
          </select>
        </Field>
      </div>

      {/* Options (for multiple choice) */}
      {form.type === "multiple_choice" && (
        <Field label="Options">
          <div className="space-y-2">
            {form.options?.map((option, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => {
                    const options = [...form.options];
                    options[i] = e.target.value;
                    setForm({ ...form, options });
                  }}
                  className="flex-1 px-3 py-2 border border-line rounded-lg bg-surface-2 text-text-primary text-sm"
                  placeholder="Option text"
                />
                <button
                  onClick={() => handleRemoveOption(i)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                placeholder="Add new option..."
                onKeyPress={(e) => e.key === "Enter" && handleAddOption()}
              />
              <Button variant="secondary" size="sm" onClick={handleAddOption}>
                Add
              </Button>
            </div>
          </div>
        </Field>
      )}

      {/* Required Toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.required}
          onChange={(e) => setForm({ ...form, required: e.target.checked })}
          className="w-4 h-4 rounded border-line"
        />
        <span className="text-sm font-medium text-text-primary">Required question</span>
      </label>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <Button variant="secondary" size="sm" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onSave(form)}
          className="flex-1"
        >
          Save
        </Button>
      </div>
    </div>
  );
}
