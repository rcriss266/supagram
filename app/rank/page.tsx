"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getTimeAgo } from "../utils/time";
import { type Post } from "../mocks/posts";
import { supabase } from "../utils/supabase";

type RankPostRow = {
  id: number | string;
  user_id?: string | null;
  image_url: string | null;
  caption: string | null;
  likes: number | null;
  created_at: string | null;
};
type RankProfileRow = { id: string; username: string | null; avatar_url: string | null };

function HeartIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-6 h-6 text-red-500"
    >
      <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
    </svg>
  );
}

function Modal({
  post,
  onClose,
}: {
  post: Post;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-card-bg rounded-xl overflow-hidden max-w-lg w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          aria-label="Cerrar"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Header con usuario */}
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-primary">
            <Image
            src={post.user?.avatar || 'https://i.pravatar.cc/150?img=8'}
            alt={post.user?.username || 'default user'}
            fill
            unoptimized
            className="object-cover"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">{post.user?.username || 'default user'}</span>
            <span className="text-xs text-foreground/50">{getTimeAgo(new Date(post.created_at))}</span>
          </div>
        </div>

        {/* Imagen */}
        <div className="relative w-full aspect-square">
          <Image
            src={post.image_url}
            alt={`Post de ${post.user?.username || 'default user'}`}
            fill
            unoptimized
            className="object-cover"
          />
        </div>

        {/* Likes y caption */}
        <div className="p-4">
          <div className="flex items-center gap-2">
            <HeartIcon />
            <span className="text-lg font-bold text-foreground">
              {post.likes.toLocaleString()} likes
            </span>
          </div>
          <p className="mt-2 text-foreground">
            <span className="font-semibold">{post.user?.username || 'default user'}</span>{" "}
            <span className="text-foreground/80">{post.caption}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RankPage() {
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function getPosts() {
      const { data, error: queryError } = await supabase
        .from("posts")
        .select("*")
        .gt("likes", 5)
        .order("likes", { ascending: false })
        .range(0, 8);

      if (!isMounted) return;
      if (queryError) {
        setError(queryError.message);
        setIsLoading(false);
        return;
      }

      const rows = (data || []) as unknown as RankPostRow[];
      const userIds = [...new Set(rows.map((post) => post.user_id).filter((id): id is string => Boolean(id)))];
      const { data: profiles, error: profilesError } = userIds.length
        ? await supabase.from("profiles").select("id, username, avatar_url").in("id", userIds)
        : { data: [], error: null };

      if (profilesError) {
        setError(`No se pudieron cargar los perfiles: ${profilesError.message}`);
        setIsLoading(false);
        return;
      }
      const profileById = new Map(
        ((profiles || []) as RankProfileRow[]).map((profile) => [profile.id, profile]),
      );
      const rankedPosts = rows
        .filter((post): post is RankPostRow & { image_url: string } => Boolean(post.image_url))
        .map((post): Post => ({
          id: post.id,
          user: {
            username: (post.user_id && profileById.get(post.user_id)?.username) || "usuario",
            avatar: (post.user_id && profileById.get(post.user_id)?.avatar_url) || "https://i.pravatar.cc/150?img=8",
          },
          image_url: post.image_url,
          caption: post.caption || "",
          likes: post.likes || 0,
          isLiked: false,
          created_at: post.created_at ? new Date(post.created_at) : new Date(),
        }));

      setPosts(rankedPosts);
      setIsLoading(false);
    }

    getPosts().catch((queryError: unknown) => {
      if (!isMounted) return;
      setError(queryError instanceof Error ? queryError.message : "No se pudo cargar el ranking.");
      setIsLoading(false);
    });

    return () => { isMounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card-bg border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-center">
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Ranking
          </h1>
        </div>
      </header>

      {/* Grid de posts */}
      <main className="max-w-2xl mx-auto p-2">
        {isLoading ? (
          <p className="py-12 text-center text-foreground/60">Cargando ranking...</p>
        ) : error ? (
          <p role="alert" className="py-12 text-center text-red-500">No se pudo cargar el ranking: {error}</p>
        ) : posts.length === 0 ? (
          <p className="py-12 text-center text-foreground/60">Todavía no hay publicaciones con suficientes likes.</p>
        ) : (
        <div className="grid grid-cols-3 gap-1">
          {posts.map((post) => (
            <button
              key={post.id}
              onClick={() => setSelectedPost(post)}
              className="relative aspect-square overflow-hidden group"
            >
              <Image
                src={post.image_url}
                alt={`Post con ${post.likes} likes`}
                fill
                unoptimized
                className="object-cover transition-transform group-hover:scale-105"
              />
              {/* Overlay con likes al hover */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <HeartIcon />
                <span className="text-white font-semibold">
                  {post.likes.toLocaleString()}
                </span>
              </div>
            </button>
          ))}
        </div>
        )}
      </main>

      {/* Modal */}
      {selectedPost && (
        <Modal post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
    </div>
  );
}
