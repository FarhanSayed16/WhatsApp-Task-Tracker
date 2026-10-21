import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  try {
    const { data } = await supabaseAdmin
      .from("task_lists")
      .select("title, group:groups!group_id(name)")
      .eq("token", token)
      .maybeSingle();

    const group = Array.isArray(data?.group) ? data?.group[0] : data?.group;
    const listTitle = data?.title || "Task checklist";
    const groupName =
      group && typeof group === "object" && "name" in group
        ? String((group as { name?: string }).name || "")
        : "";
    const title = `${listTitle} · TaskTracker`;
    const description = groupName
      ? `Open “${listTitle}” for ${groupName}. Tick tasks in the browser — no login.`
      : "Tick tasks in the browser. Updates sync live with your professor.";

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
        siteName: "TaskTracker",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
      },
    };
  } catch {
    return {
      title: "Task checklist · TaskTracker",
      description: "Tick tasks in the browser. No login required.",
    };
  }
}

export default function TokenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
