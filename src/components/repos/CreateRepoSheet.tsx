import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createRepoAction } from '../../commands/repos';
import { useAuthStore } from '../../stores/authStore';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '../ui/sheet';
import { Button } from '../ui/button';
import { Loader2 } from 'lucide-react';

const LICENSE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'apache-2.0', label: 'Apache 2.0' },
  { value: 'mit', label: 'MIT' },
  { value: 'cc-by-4.0', label: 'CC BY 4.0' },
  { value: 'cc-by-sa-4.0', label: 'CC BY-SA 4.0' },
  { value: 'cc-by-nc-4.0', label: 'CC BY-NC 4.0' },
  { value: 'other', label: 'Other' },
];

function validateRepoName(name: string): string | null {
  if (!name) return 'Name is required';
  if (name.length > 96) return 'Name must be 96 characters or fewer';
  if (!/^[a-z0-9][a-z0-9\-]*[a-z0-9]$|^[a-z0-9]$/.test(name)) {
    return 'Name must be lowercase alphanumeric and hyphens only (e.g. my-model)';
  }
  return null;
}

export interface CreateRepoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (repoId: string, repoType: 'model' | 'dataset') => void;
  defaultType?: 'model' | 'dataset';
}

export default function CreateRepoSheet({
  open,
  onOpenChange,
  onCreated,
  defaultType = 'model',
}: CreateRepoSheetProps) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // Form state — always fresh defaults (per user decision)
  const [name, setName] = useState('');
  const [type, setType] = useState<'model' | 'dataset'>(defaultType);
  const [isPrivate, setIsPrivate] = useState(false);
  const [license, setLicense] = useState('');
  const [description, setDescription] = useState('');

  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetForm() {
    setName('');
    setType(defaultType);
    setIsPrivate(false);
    setLicense('');
    setDescription('');
    setNameError(null);
    setSubmitError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

  function handleNameChange(value: string) {
    setName(value);
    if (nameError) setNameError(validateRepoName(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validationError = validateRepoName(name);
    if (validationError) {
      setNameError(validationError);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await createRepoAction({
        name,
        type,
        isPrivate,
        license: license || undefined,
        description: description || undefined,
      });

      await queryClient.invalidateQueries({ queryKey: ['repos'] });

      // result.id is the full "owner/name" id from HuggingFace
      onCreated?.(result.id, type);
      handleOpenChange(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create repository');
    } finally {
      setIsSubmitting(false);
    }
  }

  const username = user?.name ?? '';
  const previewName = name ? `${username}/${name}` : `${username}/...`;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create Repository</SheetTitle>
          <SheetDescription>
            Create a new Hugging Face repository to upload your files to.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-4 flex-1">
          {/* Repo name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Repository Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="my-model"
              className={`w-full h-8 px-3 text-sm bg-secondary border rounded-lg text-foreground placeholder:text-muted-foreground outline-none focus:border-ring ${
                nameError ? 'border-destructive' : 'border-border'
              }`}
              disabled={isSubmitting}
            />
            {/* Preview */}
            {name && (
              <p className="text-xs text-muted-foreground">
                Will be created as:{' '}
                <span className="text-foreground font-mono">{previewName}</span>
              </p>
            )}
            {nameError && (
              <p className="text-xs text-destructive">{nameError}</p>
            )}
          </div>

          {/* Type toggle */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Type</label>
            <div className="flex gap-2">
              {(['model', 'dataset'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  disabled={isSubmitting}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-colors capitalize ${
                    type === t
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary text-muted-foreground border-border hover:text-foreground hover:border-border/80'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Visibility toggle */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Visibility</label>
            <div className="flex gap-2">
              {[
                { value: false, label: 'Public' },
                { value: true, label: 'Private' },
              ].map(({ value, label }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setIsPrivate(value)}
                  disabled={isSubmitting}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                    isPrivate === value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary text-muted-foreground border-border hover:text-foreground hover:border-border/80'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* License picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              License <span className="text-muted-foreground text-xs font-normal">(optional)</span>
            </label>
            <select
              value={license}
              onChange={(e) => setLicense(e.target.value)}
              disabled={isSubmitting}
              className="w-full h-8 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground outline-none focus:border-ring"
            >
              {LICENSE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Description <span className="text-muted-foreground text-xs font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of this repository..."
              rows={3}
              disabled={isSubmitting}
              className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground outline-none focus:border-ring resize-none"
            />
          </div>

          {/* Submit error */}
          {submitError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {submitError}
            </p>
          )}
        </form>

        <SheetFooter>
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit as any}
            disabled={isSubmitting || !name.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Repository'
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
