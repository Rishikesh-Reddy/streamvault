"use client";

import { useCallback, useEffect, useState } from "react";
import type { Video } from "@/lib/types";

function emptyVideo(nextId: number): Video {
  return {
    id: nextId,
    title: "New title",
    description: "Synopsis…",
    poster_url: "https://picsum.photos/seed/new/400/600",
    stream_url: "https://www.w3schools.com/html/mov_bbb.mp4",
    category: "Drama",
    year: new Date().getFullYear(),
    rating: 4.0,
    trending: false,
    runtime_label: "~1 min",
  };
}

export function AdminCatalogPanel({ token }: { token: string }) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Video | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/videos", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      setVideos(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- session fetch */
    void load();
  }, [load]);

  const save = async (v: Video) => {
    setSaving(true);
    setError(null);
    try {
      const exists = videos.some((x) => x.id === v.id);
      const res = await fetch(
        exists ? `/api/admin/videos/${v.id}` : "/api/admin/videos",
        {
          method: exists ? "PUT" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(v),
        }
      );
      if (!res.ok) {
        setError((await res.json().catch(() => ({})))?.detail ?? res.statusText);
        return;
      }
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Remove this title from the catalog?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/videos/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const startAdd = () => {
    const nextId = videos.length ? Math.max(...videos.map((v) => v.id)) + 1 : 1;
    setEditing(emptyVideo(nextId));
  };

  if (loading) return <p className="text-sv-muted text-sm">Loading catalog…</p>;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sv-ink text-lg font-semibold">Video catalog</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="border-sv-line text-sv-muted hover:text-sv-ink rounded border px-3 py-1.5 text-sm"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={startAdd}
            className="bg-sv-accent hover:bg-sv-accent-hover rounded px-4 py-1.5 text-sm font-semibold text-white"
          >
            Add title
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-amber-300">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-sv-line bg-white/[0.03] border-b text-xs text-zinc-500 uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">ID</th>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Year</th>
              <th className="px-3 py-2 font-medium">Hot</th>
              <th className="px-3 py-2 font-medium"> </th>
            </tr>
          </thead>
          <tbody className="divide-sv-line divide-y">
            {videos.map((v) => (
              <tr key={v.id} className="hover:bg-white/[0.02]">
                <td className="text-sv-muted px-3 py-2 font-mono">{v.id}</td>
                <td className="text-sv-ink max-w-[220px] truncate px-3 py-2">{v.title}</td>
                <td className="text-sv-muted px-3 py-2">{v.category}</td>
                <td className="text-sv-muted px-3 py-2">{v.year}</td>
                <td className="text-sv-muted px-3 py-2">{v.trending ? "Yes" : "—"}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => setEditing({ ...v })}
                    className="text-sv-accent hover:text-white text-sm font-medium"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="border-sv-line bg-sv-card/80 fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4 backdrop-blur-sm">
          <div className="border-sv-line max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-[#1a1a1a] p-6 shadow-2xl">
            <h3 className="text-sv-ink text-lg font-semibold">
              {videos.some((x) => x.id === editing.id) ? "Edit title" : "New title"}
            </h3>
            <div className="mt-4 space-y-3">
              <Field label="ID" readOnly value={String(editing.id)} />
              <Field
                label="Title"
                value={editing.title}
                onChange={(title) => setEditing((e) => (e ? { ...e, title } : e))}
              />
              <label className="block text-xs text-zinc-500">
                Description
                <textarea
                  value={editing.description}
                  onChange={(ev) =>
                    setEditing((e) => (e ? { ...e, description: ev.target.value } : e))
                  }
                  rows={4}
                  className="border-sv-line bg-black/40 text-sv-ink mt-1 w-full rounded border px-3 py-2 text-sm"
                />
              </label>
              <Field
                label="Stream URL"
                value={editing.stream_url}
                onChange={(stream_url) => setEditing((e) => (e ? { ...e, stream_url } : e))}
              />
              <Field
                label="Poster URL"
                value={editing.poster_url}
                onChange={(poster_url) => setEditing((e) => (e ? { ...e, poster_url } : e))}
              />
              <Field
                label="Category"
                value={editing.category}
                onChange={(category) => setEditing((e) => (e ? { ...e, category } : e))}
              />
              <Field
                label="Year"
                type="number"
                value={String(editing.year)}
                onChange={(y) =>
                  setEditing((e) => (e ? { ...e, year: Number(y) || e.year } : e))
                }
              />
              <Field
                label="Rating"
                type="number"
                step="0.1"
                value={String(editing.rating)}
                onChange={(y) =>
                  setEditing((e) =>
                    e ? { ...e, rating: Number.parseFloat(y) || e.rating } : e
                  )
                }
              />
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={editing.trending}
                  onChange={(ev) =>
                    setEditing((e) => (e ? { ...e, trending: ev.target.checked } : e))
                  }
                />
                Trending
              </label>
              <Field
                label="Runtime label (optional)"
                value={editing.runtime_label ?? ""}
                onChange={(runtime_label) =>
                  setEditing((e) =>
                    e ? { ...e, runtime_label: runtime_label || undefined } : e
                  )
                }
              />
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void save(editing)}
                className="bg-sv-accent hover:bg-sv-accent-hover rounded px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              {videos.some((x) => x.id === editing.id) && (
                <button
                  type="button"
                  onClick={() => void remove(editing.id)}
                  className="rounded border border-red-900/50 bg-red-950/40 px-4 py-2 text-sm text-red-200"
                >
                  Delete
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-sv-muted hover:text-sv-ink px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  readOnly,
  type = "text",
  step,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  type?: string;
  step?: string;
}) {
  return (
    <label className="block text-xs text-zinc-500">
      {label}
      <input
        type={type}
        step={step}
        readOnly={readOnly}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="border-sv-line bg-black/40 text-sv-ink mt-1 w-full rounded border px-3 py-2 text-sm read-only:opacity-70"
      />
    </label>
  );
}
