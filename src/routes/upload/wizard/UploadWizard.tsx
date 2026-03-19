import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { type RepoItem } from '../../../queries/useRepos';
import { type FileEntry } from './StepFilePicker';
import StepRepoPicker from './StepRepoPicker';
import StepFilePicker from './StepFilePicker';
import StepReview from './StepReview';

const STEPS = [
  { label: 'Select Repo' },
  { label: 'Select Files' },
  { label: 'Review & Upload' },
];

interface UploadWizardProps {
  onComplete?: () => void;
}

export default function UploadWizard({ onComplete }: UploadWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedRepo, setSelectedRepo] = useState<RepoItem | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [commitMessage, setCommitMessage] = useState('');

  function canAdvance(): boolean {
    if (currentStep === 1) return selectedRepo !== null;
    if (currentStep === 2) return files.length > 0;
    if (currentStep === 3) return commitMessage.trim().length > 0;
    return false;
  }

  function handleNext() {
    if (canAdvance() && currentStep < 3) {
      setCurrentStep((s) => s + 1);
    }
  }

  function handleBack() {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
    }
  }

  function handleUploadComplete() {
    onComplete?.();
  }

  return (
    <div className="flex flex-col h-full">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-0 mb-6 px-4">
        {STEPS.map((step, idx) => {
          const stepNum = idx + 1;
          const isCompleted = currentStep > stepNum;
          const isCurrent = currentStep === stepNum;

          return (
            <div key={stepNum} className="flex items-center">
              {/* Step dot */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    isCompleted
                      ? 'bg-primary text-primary-foreground'
                      : isCurrent
                      ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                      : 'bg-secondary text-muted-foreground border border-border'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    stepNum
                  )}
                </div>
                <span
                  className={`text-xs whitespace-nowrap ${
                    isCurrent ? 'text-foreground font-medium' : 'text-muted-foreground'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {idx < STEPS.length - 1 && (
                <div
                  className={`w-16 h-0.5 mb-4 mx-2 transition-colors ${
                    currentStep > stepNum ? 'bg-primary' : 'bg-border'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {currentStep === 1 && (
          <StepRepoPicker
            selectedRepo={selectedRepo}
            onSelect={setSelectedRepo}
          />
        )}
        {currentStep === 2 && (
          <StepFilePicker files={files} onFilesChange={setFiles} />
        )}
        {currentStep === 3 && selectedRepo && (
          <StepReview
            selectedRepo={selectedRepo}
            files={files}
            commitMessage={commitMessage}
            onCommitMessageChange={setCommitMessage}
            onUploadComplete={handleUploadComplete}
          />
        )}
      </div>

      {/* Navigation — hidden on step 3 (StepReview has its own Upload button) */}
      {currentStep < 3 && (
        <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            disabled={currentStep === 1}
          >
            Back
          </Button>
          <Button
            size="sm"
            onClick={handleNext}
            disabled={!canAdvance()}
          >
            {currentStep === 2 ? 'Review' : 'Next'}
          </Button>
        </div>
      )}
      {currentStep === 3 && (
        <div className="flex items-center pt-4 border-t border-border mt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
          >
            Back
          </Button>
        </div>
      )}
    </div>
  );
}
