// By using `export {}`, we treat this file as a module,
// which is necessary for the `declare global` to work correctly.
export {};

declare global {
  // Define the Task type globally for the renderer process
  interface Task {
    id: number;
    title: string;
    status: 'pending' | 'completed';
    created_date: string;
    finished_date: string | null;
    tags: string[];
    priority: number;
  }

  interface Folder {
    id: string;
    name: string;
    parentId: string | null;
  }

  interface MeetingNote {
    id: string;
    title: string;
    content: string; // Will be HTML
    folderId: string;
    created_date: string;
    modified_date: string;
  }

  interface Window {
    Sortable: typeof import('sortablejs');
    api: {
      getTasks: (options: {
        searchQuery?: string;
        filterTag?: string;
        page?: number;
      }) => Promise<{
        tasks: Task[];
        total: number;
        page: number;
        limit: number;
      }>;
      getTags: () => Promise<string[]>;
      createTask: (taskData: {
        title: string;
        tags: string[];
      }) => Promise<Task>;
      updateTask: (
        taskId: number,
        updates: Partial<Omit<Task, 'id'>>
      ) => Promise<Task>;
      deleteTask: (taskId: number) => Promise<{ success: true }>;
      updateTaskOrder: (data: {
        movedTaskId: number;
        prevId: number | null;
        nextId: number | null;
      }) => Promise<{ success: true }>;

      // Meeting Notes
      getAllMeetingsData: () => Promise<{ folders: Folder[], notes: MeetingNote[] }>;
      createFolder: (folderData: { name: string; parentId: string | null }) => Promise<Folder>;
      updateFolder: (folderId: string, name: string) => Promise<Folder>;
      createNote: (noteData: { title: string; content: string; folderId: string }) => Promise<MeetingNote>;
      updateNote: (noteId: string, updates: Partial<Omit<MeetingNote, 'id'>>) => Promise<MeetingNote>;
      deleteNote: (noteId: string) => Promise<{ success: true }>;
      deleteFolder: (folderId: string) => Promise<{ success: true }>;
    };
  }
}
