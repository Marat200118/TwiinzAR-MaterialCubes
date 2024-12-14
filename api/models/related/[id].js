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
    const relatedModelId = id === "2" ? "4" : "2";
    const { data, error } = await supabase
      .from("models")
      .select("*")
      .eq("id", relatedModelId);

    if (error) {
      console.error(`Error fetching related model for id ${id}:`, error);
      res.status(500).json({ error: "Failed to fetch related model." });
      return;
    }

    if (!data || data.length === 0) {
      res.status(404).json({ error: `No related model found for ID ${id}` });
      return;
    }

    res.status(200).json(data[0]);
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({ error: "An unexpected error occurred." });
  }
}
