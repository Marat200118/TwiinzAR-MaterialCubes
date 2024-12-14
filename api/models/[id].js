import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    const { data, error } = await supabase
      .from("models")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error(`Error fetching model with id ${id}:`, error);
      res.status(500).json({ error: "Failed to fetch model details." });
      return;
    }

    if (!data) {
      res.status(404).json({ error: `Model with ID ${id} not found.` });
      return;
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({ error: "An unexpected error occurred." });
  }
}
