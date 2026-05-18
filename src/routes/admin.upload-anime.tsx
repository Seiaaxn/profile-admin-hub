import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Shield, Loader2, Upload, Trash2, Film } from "lucide-react";
import { toast } from "sonner";
import { ref, push, set, onValue, remove, serverTimestamp } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/useAuth";
import { isAdmin } from "@/lib/roles";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fileToCompressedDataUrl } from "@/lib/social";

export const Route = createFileRoute("/admin/upload-anime")({
  component: AdminUploadAnime,
});

const GENRE_OPTIONS = [
  "action", "adventure", "comedy", "drama", "fantasy",
  "isekai", "romance", "sci-fi", "slice-of-life", "thriller",
];

type AnimeRow = {
  id: string;
  title: string;
  type: string;
  year: number;
  episodes: number;
  cover?: string;
  banner?: string;
  synopsis?: string;
  genres?: string[];
  ts?: number;
};

function AdminUploadAnime() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const allowed = isAdmin(user?.email);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<"TV" | "MOVIE" | "ONA" | "OVA">("TV");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [episodes, setEpisodes] = useState<number>(12);
  const [synopsis, setSynopsis] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<AnimeRow[]>([]);

  useEffect(() => {
    if (!allowed) return;
    const unsub = onValue(ref(db, "customAnimes"), (snap) => {
      const arr: AnimeRow[] = [];
      snap.forEach((c) => { arr.push({ id: c.key!, ...(c.val() as Omit<AnimeRow, "id">) }); });
      arr.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
      setList(arr);
    });
    return () => unsub();
  }, [allowed]);

  const toggleGenre = (g: string) =>
    setGenres((p) => (p.includes(g) ? p.filter((x) => x !== g) : [...p, g]));

  const onPickFile = (setter: (v: string) => void) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("File harus gambar.");
    if (f.size > 10 * 1024 * 1024) return toast.error("Maksimal 10MB.");
    try {
      const url = await fileToCompressedDataUrl(f, 720, 0.85);
      setter(url);
      toast.success("Gambar dimuat.");
    } catch (err) {
      toast.error("Gagal: " + (err as Error).message);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allowed || !user) return;
    if (!title.trim()) return toast.error("Judul wajib diisi.");
    if (!coverUrl) return toast.error("Cover wajib diisi.");
    setBusy(true);
    try {
      const newRef = push(ref(db, "customAnimes"));
      await set(newRef, {
        title: title.trim(),
        type, year, episodes,
        synopsis: synopsis.trim(),
        cover: coverUrl,
        banner: bannerUrl || coverUrl,
        genres,
        uploadedBy: user.uid,
        ts: serverTimestamp(),
      });
      toast.success("Anime diupload.");
      setTitle(""); setSynopsis(""); setCoverUrl(""); setBannerUrl(""); setGenres([]);
    } catch (err) {
      toast.error("Gagal: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const del = async (id: string) => {
    if (!confirm("Hapus anime ini?")) return;
    try {
      await remove(ref(db, `customAnimes/${id}`));
      toast.success("Dihapus.");
    } catch (err) {
      toast.error("Gagal: " + (err as Error).message);
    }
  };

  if (loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!allowed) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="text-center max-w-sm">
          <Shield className="h-10 w-10 text-destructive mx-auto" />
          <h1 className="mt-3 text-xl font-black">Akses Ditolak</h1>
          <p className="text-sm text-muted-foreground mt-1">Halaman ini hanya untuk administrator.</p>
          <Link to="/home" className="mt-4 inline-block text-primary underline text-sm">Kembali ke Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => router.history.back()} className="h-10 w-10 grid place-items-center rounded-lg hover:bg-secondary"><ArrowLeft className="h-5 w-5" /></button>
          <h1 className="text-lg font-black tracking-wider flex items-center gap-2"><Film className="h-5 w-5 text-primary" /> UPLOAD ANIME</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-6 space-y-6">
        <form onSubmit={submit} className="rounded-2xl border border-border bg-card/60 p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">Judul</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul anime" required />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Tipe</label>
              <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="w-full h-10 rounded-md bg-secondary border border-border px-3 text-sm">
                <option value="TV">TV</option><option value="MOVIE">MOVIE</option>
                <option value="ONA">ONA</option><option value="OVA">OVA</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Tahun</label>
              <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Episode</label>
              <Input type="number" value={episodes} onChange={(e) => setEpisodes(Number(e.target.value))} />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase">Sinopsis</label>
            <Textarea value={synopsis} onChange={(e) => setSynopsis(e.target.value)} rows={4} placeholder="Sinopsis anime..." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Cover (wajib)</label>
              <div className="flex gap-2 items-start">
                <Input value={coverUrl.startsWith("data:") ? "" : coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="URL atau upload" />
                <label className="h-10 px-3 rounded-md bg-secondary border border-border grid place-items-center cursor-pointer">
                  <Upload className="h-4 w-4" />
                  <input type="file" accept="image/*" className="hidden" onChange={onPickFile(setCoverUrl)} />
                </label>
              </div>
              {coverUrl && <img src={coverUrl} alt="" className="mt-2 h-32 rounded object-cover" />}
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Banner (opsional)</label>
              <div className="flex gap-2 items-start">
                <Input value={bannerUrl.startsWith("data:") ? "" : bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} placeholder="URL atau upload" />
                <label className="h-10 px-3 rounded-md bg-secondary border border-border grid place-items-center cursor-pointer">
                  <Upload className="h-4 w-4" />
                  <input type="file" accept="image/*" className="hidden" onChange={onPickFile(setBannerUrl)} />
                </label>
              </div>
              {bannerUrl && <img src={bannerUrl} alt="" className="mt-2 h-32 rounded object-cover" />}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase block mb-2">Genre</label>
            <div className="flex flex-wrap gap-2">
              {GENRE_OPTIONS.map((g) => (
                <button key={g} type="button" onClick={() => toggleGenre(g)} className={`text-xs px-3 h-8 rounded-full border ${genres.includes(g) ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4 mr-2" /> Upload Anime</>}
          </Button>
        </form>

        <section>
          <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-3">Anime Terupload ({list.length})</h2>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10 border border-dashed border-border rounded-xl">Belum ada anime.</p>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {list.map((a) => (
                <li key={a.id} className="rounded-xl overflow-hidden border border-border bg-card/40 relative group">
                  <div className="aspect-[2/3] bg-secondary">
                    {a.cover && <img src={a.cover} alt="" loading="lazy" className="w-full h-full object-cover" />}
                  </div>
                  <div className="p-2">
                    <div className="text-xs font-bold line-clamp-2">{a.title}</div>
                    <div className="text-[10px] text-muted-foreground">{a.type} • {a.year} • {a.episodes} eps</div>
                  </div>
                  <button onClick={() => del(a.id)} className="absolute top-1 right-1 h-7 w-7 grid place-items-center rounded-md bg-background/80 text-destructive opacity-0 group-hover:opacity-100">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
