// Public settings: the only file the pedestrian page (index.html) reads.
// Fill these in after creating your Supabase project (Project Settings → API).
// Leave them empty to run in DEMO MODE: everything works, but data is only stored in this browser.
window.SNAKE_CONFIG = Object.assign(window.SNAKE_CONFIG || {}, {
  SUPABASE_URL: "",   // e.g. "https://abcdefghijkl.supabase.co"
  SUPABASE_KEY: "",   // the publishable (anon) key. It is safe to put here: the database rules decide what it can do.
  PHOTO_BUCKET: "report-photos",
  // where the pedestrian page's "Become a collector" banner points
  COLLECTOR_URL: "https://claude.ai/artifact/R4khunsRCzR73HT8eMAz5U",
});
