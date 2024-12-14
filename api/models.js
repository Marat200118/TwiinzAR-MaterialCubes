import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    const { data, error } = await supabase.from("models").select("*");

    if (error) {
      console.error("Error fetching models:", error);
      res.status(500).json({ error: "Failed to fetch models." });
      return;
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({ error: "An unexpected error occurred." });
  }
}
