"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../utils/supabase";

type ProfilePost = {
  id: number | string;
  image_url: string;
  caption: string | null;
  likes: number | null;
  created_at: string;
};

type ProfileState = {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selectedPost, setSelectedPost] = useState<ProfilePost | null>(null);

  const loadProfile = useCallback(async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      router.replace("/auth/login");
      return;
    }

    const [{ data: savedProfile }, { data: userPosts, error: postsError }, postsFilesResult, imagesFilesResult] = await Promise.all([
      supabase.from("profiles").select("username, avatar_url").eq("id", user.id).maybeSingle(),
      supabase
        .from("posts")
        .select("id, image_url, caption, likes, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.storage.from("supagram").list("posts", {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      }),
      supabase.storage.from("supagram").list("images", {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      }),
    ]);

    setProfile({
      id: user.id,
      username: savedProfile?.username || user.user_metadata?.username || "usuario",
      email: user.email || "",
      avatarUrl: savedProfile?.avatar_url || user.user_metadata?.avatar_url || null,
    });
    const databasePosts: ProfilePost[] = (userPosts || []).map((post) => ({
      ...post,
      created_at: post.created_at || new Date().toISOString(),
    }));
    const storageFiles = [
      ...(postsFilesResult.data || []).map((file) => ({ folder: "posts", file })),
      ...(imagesFilesResult.data || []).map((file) => ({ folder: "images", file })),
    ];
    const storedImages: ProfilePost[] = storageFiles
      .filter(({ file }) => file.id && file.name && !file.name.startsWith("."))
      .filter(({ file }) => /\.(avif|gif|jpe?g|png|webp)$/i.test(file.name))
      .map(({ folder, file }) => {
        const path = `${folder}/${file.name}`;
        return {
          id: path,
          image_url: supabase.storage.from("supagram").getPublicUrl(path).data.publicUrl,
          caption: null,
          likes: 0,
          created_at: file.created_at || file.updated_at || new Date().toISOString(),
        };
      });
    const allPosts = [...databasePosts, ...storedImages];
    const uniquePosts = allPosts.filter((post, index) =>
      allPosts.findIndex((candidate) => candidate.image_url === post.image_url) === index,
    );
    uniquePosts.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    setPosts(uniquePosts);
    if (postsError) setError(`No se pudieron cargar tus publicaciones: ${postsError.message}`);
    else if (postsFilesResult.error || imagesFilesResult.error) {
      const storageError = postsFilesResult.error ?? imagesFilesResult.error;
      if (!storageError) return;
      setError(`Supabase no permitió listar las imágenes del bucket: ${storageError.message}`);
    }
  }, [router]);

  useEffect(() => {
    let isMounted = true;
    async function initialize() {
      try {
        await loadProfile();
      } catch (loadError) {
        if (isMounted) setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el perfil.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void initialize();
    return () => { isMounted = false; };
  }, [loadProfile]);

  function beginEditing() {
    if (!profile) return;
    setUsernameDraft(profile.username);
    setAvatarFile(null);
    setAvatarPreview(profile.avatarUrl);
    setError("");
    setIsEditing(true);
  }

  function chooseAvatar(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("El archivo debe ser una imagen.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen debe pesar menos de 5 MB.");
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setError("");
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    const username = usernameDraft.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      setError("El nombre debe tener entre 3 y 20 caracteres: letras, números o guion bajo.");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      let avatarUrl = profile.avatarUrl;
      if (avatarFile) {
        const extension = avatarFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const objectPath = `avatars/${profile.id}/${Date.now()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("supagram")
          .upload(objectPath, avatarFile, { cacheControl: "3600", upsert: false });
        if (uploadError) {
          throw new Error(`No se pudo subir la foto al bucket supagram: ${uploadError.message}`);
        }
        avatarUrl = supabase.storage.from("supagram").getPublicUrl(objectPath).data.publicUrl;
      }

      const { error: authUpdateError } = await supabase.auth.updateUser({
        data: { username, avatar_url: avatarUrl },
      });
      if (authUpdateError) throw authUpdateError;

      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .upsert({ id: profile.id, username, avatar_url: avatarUrl }, { onConflict: "id" });
      if (profileUpdateError) throw profileUpdateError;

      setProfile({ ...profile, username, avatarUrl });
      setIsEditing(false);
      setAvatarFile(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el perfil.");
    } finally {
      setIsSaving(false);
    }
  }

  async function signOut() {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      return;
    }
    router.replace("/auth/login");
  }

  if (isLoading) {
    return <main className="min-h-screen bg-background p-8 text-center text-foreground/60">Cargando perfil...</main>;
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-background p-8 text-center">
        <p className="text-red-500">{error || "Inicia sesión para ver tu perfil."}</p>
        <Link className="mt-4 inline-block text-primary underline" href="/auth/login">Iniciar sesión</Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 pb-24">
      <header className="sticky top-0 z-30 border-b border-border bg-card-bg">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold text-foreground">Mi perfil</h1>
          <button onClick={signOut} className="text-sm font-semibold text-primary">Cerrar sesión</button>
        </div>
      </header>

      <section className="mx-auto flex max-w-2xl items-center gap-6 px-2 py-8 sm:gap-12 sm:px-8">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-primary text-3xl font-bold text-white sm:h-32 sm:w-32 sm:text-5xl">
          {profile.avatarUrl ? (
            <Image src={profile.avatarUrl} alt={`Foto de ${profile.username}`} fill unoptimized sizes="(max-width: 640px) 80px, 128px" className="object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center">{profile.username.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-semibold text-foreground">@{profile.username}</h2>
          <p className="mt-1 truncate text-sm text-foreground/60">{profile.email}</p>
          <p className="mt-3 text-sm text-foreground"><strong>{posts.length}</strong> publicaciones</p>
          <button onClick={beginEditing} className="mt-3 rounded-lg border border-border px-4 py-1.5 text-sm font-semibold text-foreground hover:bg-background">
            Editar perfil
          </button>
        </div>
      </section>

      {error && <p role="alert" className="mx-auto mb-4 max-w-2xl text-sm text-red-500">{error}</p>}

      <section className="mx-auto max-w-2xl border-t border-border pt-4">
        <h3 className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-foreground/60">Publicaciones</h3>
        {posts.length ? (
          <div className="grid grid-cols-3 gap-1 sm:gap-2">
            {posts.map((post) => (
              <button key={post.id} onClick={() => setSelectedPost(post)} className="group relative aspect-square overflow-hidden bg-card-bg" aria-label={`Ver publicación: ${post.caption || "sin descripción"}`}>
                <Image src={post.image_url} alt={post.caption || "Imagen publicada"} fill unoptimized sizes="(max-width: 640px) 33vw, 210px" className="object-cover transition-transform group-hover:scale-105" />
                <span className="absolute inset-0 flex items-center justify-center gap-1 bg-black/40 text-sm font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">♥ {post.likes ?? 0}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <p className="font-semibold text-foreground">Aún no tienes publicaciones</p>
            <Link href="/post" className="mt-3 inline-block text-sm font-semibold text-primary">Comparte tu primera foto</Link>
          </div>
        )}
      </section>

      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setIsEditing(false)}>
          <form onSubmit={saveProfile} onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl bg-card-bg p-6 shadow-xl">
            <h2 className="text-xl font-bold text-foreground">Editar perfil</h2>
            <label className="mt-5 flex cursor-pointer flex-col items-center gap-3">
              <span className="relative h-24 w-24 overflow-hidden rounded-full bg-primary text-3xl font-bold text-white">
                {avatarPreview ? <Image src={avatarPreview} alt="Vista previa de la foto" fill unoptimized className="object-cover" /> : <span className="flex h-full items-center justify-center">{usernameDraft.charAt(0).toUpperCase() || "?"}</span>}
              </span>
              <span className="text-sm font-semibold text-primary">Cambiar foto</span>
              <input type="file" accept="image/*" className="sr-only" onChange={(event) => chooseAvatar(event.target.files?.[0])} />
            </label>
            <label className="mt-5 block text-sm font-medium text-foreground" htmlFor="profile-username">Nombre de usuario</label>
            <input id="profile-username" value={usernameDraft} onChange={(event) => setUsernameDraft(event.target.value)} maxLength={20} required className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-primary/40" />
            {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setIsEditing(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-foreground">Cancelar</button>
              <button type="submit" disabled={isSaving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{isSaving ? "Guardando..." : "Guardar cambios"}</button>
            </div>
          </form>
        </div>
      )}

      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={() => setSelectedPost(null)}>
          <div className="relative w-full max-w-lg overflow-hidden rounded-xl bg-card-bg" onClick={(event) => event.stopPropagation()}>
            <div className="relative aspect-square">
              <Image src={selectedPost.image_url} alt={selectedPost.caption || "Publicación"} fill unoptimized sizes="(max-width: 640px) 100vw, 512px" className="object-contain" />
            </div>
            <div className="p-4">
              <p className="font-semibold text-foreground">@{profile.username}</p>
              {selectedPost.caption && <p className="mt-1 text-foreground/80">{selectedPost.caption}</p>}
              <p className="mt-2 text-sm text-foreground/60">♥ {selectedPost.likes ?? 0} · {new Date(selectedPost.created_at).toLocaleDateString("es-MX")}</p>
            </div>
            <button onClick={() => setSelectedPost(null)} className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-white" aria-label="Cerrar publicación">×</button>
          </div>
        </div>
      )}
    </main>
  );
}
