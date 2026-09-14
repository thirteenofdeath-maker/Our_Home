import { buttonClassName } from "@/components/ui/Button";
import { archiveTemplateAction } from "../actions";

export function ArchiveTemplateForm({ templateId }: { templateId: string }) {
  return (
    <form action={archiveTemplateAction}>
      <input type="hidden" name="id" value={templateId} />
      <button type="submit" className={buttonClassName("secondary", "lg", "text-danger")}>
        เก็บถาวร Template
      </button>
    </form>
  );
}
