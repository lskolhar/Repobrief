import { supabase } from "./supabase";

export async function uploadMeetingMp3(file: File) {
  if (file.size > 50 * 1024 * 1024) {
    throw new Error("File size exceeds 50MB limit.");
  }
  if (!file.type.startsWith("audio/mp3") && !file.name.endsWith(".mp3")) {
    throw new Error("Only MP3 files are allowed.");
  }
  const filePath = `meetings/${Date.now()}_${file.name}`;
  const { data, error } = await supabase.storage
    .from("meetings")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
  if (error) throw error;
  const { data: publicUrlData } = supabase.storage.from("meetings").getPublicUrl(filePath);
  return publicUrlData?.publicUrl;
}