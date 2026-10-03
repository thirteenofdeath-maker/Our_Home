import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export interface TransactionAttachment {
  id: string;
  transactionId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  url: string;
}

export async function listTransactionAttachments(
  supabase: SupabaseClient<Database>,
  transactionId: string,
): Promise<TransactionAttachment[]> {
  const { data, error } = await supabase
    .from("transaction_attachments")
    .select("id,transaction_id,storage_path,mime_type,file_name,file_size")
    .eq("transaction_id", transactionId)
    .order("created_at");
  if (error) throw error;
  const attachments = data ?? [];
  if (attachments.length === 0) return [];
  const { data: signed } = await supabase.storage
    .from("finance-attachments")
    .createSignedUrls(
      attachments.map((attachment) => attachment.storage_path),
      3600,
    );
  const urls = new Map(
    (signed ?? []).map((item) => [item.path, item.signedUrl ?? ""]),
  );
  return attachments.map((attachment) => ({
    id: attachment.id,
    transactionId: attachment.transaction_id,
    fileName: attachment.file_name,
    mimeType: attachment.mime_type,
    fileSize: attachment.file_size,
    url: urls.get(attachment.storage_path) ?? "",
  }));
}
