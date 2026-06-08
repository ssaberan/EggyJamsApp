import { useEffect, useState, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FolderOpen, Plus, Clock, X, Trash2 } from 'lucide-react';
import { projectRepository } from '../storage';
import type { ProjectMeta } from '../storage';
import ThemeToggle from '../components/ThemeToggle';
import {
  setDesktopMenuHandlers,
  clearDesktopMenuHandlers,
} from '../desktop/menuBridge';

function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return date.toLocaleDateString();
}

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [projectParentDir, setProjectParentDir] = useState<string | null>(null);
  const [defaultProjectsDir, setDefaultProjectsDir] = useState<string | null>(null);
  const [choosingLocation, setChoosingLocation] = useState(false);
  const [creating, setCreating] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true);
    setError(null);
    try {
      const data = await projectRepository.listProjects();
      setProjects(data);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to load projects');
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  const loadDefaultProjectsDir = useCallback(async () => {
    try {
      const dir = await window.electronAPI?.getDefaultProjectsDir?.();
      setDefaultProjectsDir(dir ?? null);
    } catch {
      setDefaultProjectsDir(null);
    }
  }, []);

  const openNewProjectModal = useCallback(() => {
    setShowModal(true);
    setError(null);
    setNewTitle('');
    setProjectParentDir(null);
    void loadDefaultProjectsDir();
  }, [loadDefaultProjectsDir]);

  useEffect(() => {
    void fetchProjects();
    void loadDefaultProjectsDir();
  }, [fetchProjects, loadDefaultProjectsDir]);

  useEffect(() => {
    setDesktopMenuHandlers({
      onNewProject: openNewProjectModal,
    });
    return () => clearDesktopMenuHandlers(['onNewProject']);
  }, [openNewProjectModal]);

  useEffect(() => {
    const state = location.state as { openNewProject?: boolean } | null;
    if (state?.openNewProject) {
      openNewProjectModal();
      navigate('/', { replace: true, state: null });
    }
  }, [location.state, navigate, openNewProjectModal]);

  const handleChooseProjectLocation = async () => {
    if (!window.electronAPI?.pickProjectParentDirectory) return;

    setChoosingLocation(true);
    setError(null);

    try {
      const dir = await window.electronAPI.pickProjectParentDirectory(
        'Choose Project Location',
      );
      if (dir) setProjectParentDir(dir);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to choose project location',
      );
    } finally {
      setChoosingLocation(false);
    }
  };

  const handleOpenProject = async () => {
    if (!window.electronAPI?.openProjectFromFolder) return;

    setOpening(true);
    setError(null);

    try {
      const projectId = await window.electronAPI.openProjectFromFolder();
      if (projectId) {
        window.electronAPI.refreshMenu();
        navigate(`/editor/${projectId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open project');
    } finally {
      setOpening(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setCreating(true);
    setError(null);

    try {
      const project = await projectRepository.createProject(
        newTitle.trim(),
        projectParentDir ?? undefined,
      );
      setNewTitle('');
      setProjectParentDir(null);
      setShowModal(false);
      window.electronAPI?.refreshMenu();
      navigate(`/editor/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!deletingProjectId) return;

    setDeleting(true);
    setError(null);

    try {
      await projectRepository.deleteProject(deletingProjectId);
      setProjects((prev) => prev.filter((p) => p.id !== deletingProjectId));
      setDeletingProjectId(null);
      window.electronAPI?.refreshMenu();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">My Projects</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Create and manage your local projects.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={() => void handleOpenProject()}
            disabled={opening}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            {opening ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                Opening...
              </>
            ) : (
              <>
                <FolderOpen className="h-4 w-4" />
                Open Project
              </>
            )}
          </button>
          <button
            onClick={openNewProjectModal}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            New Project
          </button>
        </div>
      </div>

      {error && !showModal && !deletingProjectId && (
        <div className="mb-6 flex items-center justify-between rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3">
          <span className="text-sm text-red-600 dark:text-red-300">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-3 text-red-400 hover:text-red-600 dark:hover:text-red-200 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loadingProjects ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 py-16 text-center">
          <FolderOpen className="h-12 w-12 text-gray-300 dark:text-gray-500 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Create your first game</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-sm">
            Start a new project to build your narrative game locally.
          </p>
          <button
            onClick={openNewProjectModal}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            New Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project) => (
            <div
              key={project.id}
              className="group relative rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600 transition-all"
            >
              <button
                onClick={() => setDeletingProjectId(project.id)}
                className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-white/80 dark:bg-gray-800/80 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-all cursor-pointer shadow-sm border border-gray-200 dark:border-gray-700"
                title="Delete project"
              >
                <Trash2 className="h-4 w-4" />
              </button>

              <Link to={`/editor/${project.id}`} className="block">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/30 p-2.5 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 transition-colors">
                    <FolderOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                      {project.title}
                    </h3>
                    {project.description && (
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                        {project.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Updated {timeAgo(project.lastModified)}</span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}

      {deletingProjectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Delete Project</h2>
              <button
                onClick={() => { setDeletingProjectId(null); setError(null); }}
                disabled={deleting}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {projects.find((p) => p.id === deletingProjectId)?.title}
              </span>
              ?
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              This will permanently delete the project folder and all its assets. This action cannot be undone.
            </p>

            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-600 dark:text-red-300 mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setDeletingProjectId(null); setError(null); }}
                disabled={deleting}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteProject()}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {deleting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">New Project</h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setProjectParentDir(null);
                }}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateProject(e)} className="space-y-4">
              <div>
                <label
                  htmlFor="projectTitle"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Project Title
                </label>
                <input
                  id="projectTitle"
                  type="text"
                  required
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="My Visual Novel"
                  className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-200 shadow-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label
                  htmlFor="projectLocation"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Save Location
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="projectLocation"
                    type="text"
                    readOnly
                    value={projectParentDir ?? defaultProjectsDir ?? 'Default projects folder'}
                    className="block min-w-0 flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void handleChooseProjectLocation()}
                    disabled={creating || choosingLocation}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {choosingLocation ? 'Choosing...' : 'Choose...'}
                  </button>
                </div>
                {projectParentDir && (
                  <button
                    type="button"
                    onClick={() => setProjectParentDir(null)}
                    disabled={creating}
                    className="mt-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 disabled:opacity-50"
                  >
                    Use default location
                  </button>
                )}
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-600 dark:text-red-300">
                  {error}
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setProjectParentDir(null);
                  }}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newTitle.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {creating ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Creating…
                    </>
                  ) : (
                    'Create Project'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
