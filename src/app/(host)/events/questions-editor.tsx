"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { MAX_QUESTIONS, QUESTION_TYPES, type QuestionDraft } from "@/questions/question";

const TYPE_LABELS = { text: "questionText", choice: "questionChoice", yesNo: "questionYesNo" } as const;

// The host's questions, edited as one list and saved with the event, so a host can write them
// while they create it. The list travels in a single hidden field; the action reads it back.
export function QuestionsEditor({
  questions,
  answerCounts,
}: {
  questions: QuestionDraft[];
  answerCounts: Record<string, number>;
}) {
  const t = useTranslations("Events.form");
  const [drafts, setDrafts] = useState(questions);

  const change = (at: number, patch: Partial<QuestionDraft>) =>
    setDrafts(drafts.map((draft, index) => (index === at ? { ...draft, ...patch } : draft)));

  const move = (from: number, by: number) => {
    const to = from + by;
    if (to < 0 || to >= drafts.length) return;
    const moved = [...drafts];
    [moved[from], moved[to]] = [moved[to], moved[from]];
    setDrafts(moved);
  };

  const remove = (at: number) => setDrafts(drafts.filter((_, index) => index !== at));

  return (
    <Field>
      <FieldLabel>{t("questions")}</FieldLabel>
      <FieldDescription>{t("questionsHint")}</FieldDescription>
      <input type="hidden" name="questions" value={JSON.stringify(drafts)} />

      <ol className="flex flex-col gap-3">
        {drafts.map((draft, index) => (
          <li key={index} className="flex flex-col gap-3 rounded-xl bg-muted/40 p-3 ring-1 ring-foreground/10">
            <div className="flex items-start gap-2">
              <Input
                aria-label={t("questionPrompt", { number: index + 1 })}
                value={draft.prompt}
                onChange={(typed) => change(index, { prompt: typed.target.value })}
                placeholder={t("questionPromptHint")}
              />
              <Button type="button" variant="ghost" size="icon" aria-label={t("questionUp")} onClick={() => move(index, -1)}>
                <ArrowUp />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label={t("questionDown")} onClick={() => move(index, 1)}>
                <ArrowDown />
              </Button>
              <RemoveQuestion
                answers={draft.id ? (answerCounts[draft.id] ?? 0) : 0}
                prompt={draft.prompt}
                onRemove={() => remove(index)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <NativeSelect
                aria-label={t("questionType", { number: index + 1 })}
                className="w-auto"
                value={draft.type}
                onChange={(picked) => change(index, { type: picked.target.value })}
              >
                {QUESTION_TYPES.map((type) => (
                  <NativeSelectOption key={type} value={type}>
                    {t(TYPE_LABELS[type])}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={draft.required}
                  onCheckedChange={(checked) => change(index, { required: checked === true })}
                />
                {t("questionRequired")}
              </label>
            </div>

            {draft.type === "choice" && (
              <Input
                aria-label={t("questionChoices", { number: index + 1 })}
                value={draft.options.join(", ")}
                onChange={(typed) => change(index, { options: typed.target.value.split(",").map((option) => option.trim()) })}
                placeholder={t("questionChoicesHint")}
              />
            )}
          </li>
        ))}
      </ol>

      {drafts.length < MAX_QUESTIONS && (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() => setDrafts([...drafts, { type: "text", prompt: "", options: [], required: false }])}
        >
          <Plus /> {t("questionAdd")}
        </Button>
      )}
    </Field>
  );
}

// Removing a question the guests have already answered throws those answers away, so it says so
// first. A question nobody has answered yet just goes.
function RemoveQuestion({ answers, prompt, onRemove }: { answers: number; prompt: string; onRemove: () => void }) {
  const t = useTranslations("Events.form");
  const label = t("questionRemove");

  if (answers === 0) {
    return (
      <Button type="button" variant="ghost" size="icon" aria-label={label} onClick={onRemove}>
        <X />
      </Button>
    );
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={label}>
          <X />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("questionRemoveTitle", { prompt })}</AlertDialogTitle>
          <AlertDialogDescription>{t("questionRemoveText", { count: answers })}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="pt-4">
          <AlertDialogCancel type="button">{t("questionRemoveCancel")}</AlertDialogCancel>
          <AlertDialogAction type="button" onClick={onRemove}>
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
