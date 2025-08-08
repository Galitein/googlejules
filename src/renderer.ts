/// <reference path="renderer.d.ts" />

// --- STATE ---
let currentPage = 1;
let searchQuery = '';
let filterTag = '';
let meetingsData: { folders: Folder[], notes: MeetingNote[] } = { folders: [], notes: [] };
let selectedFolderId: string | null = null;

// --- SAFE ELEMENT GETTER ---
function getElem<T extends HTMLElement = HTMLElement>(id: string): T | null {
    return document.getElementById(id) as T | null;
}

// --- DOM EVENT LISTENER ---
document.addEventListener('DOMContentLoaded', () => {
    // Tab elements
    const tabButtons = {
        dashboard: getElem('dashboard-tab-btn'),
        tasks: getElem('tasks-tab-btn'),
        meetingNotes: getElem('meeting-notes-tab-btn'),
    };
    const views = {
        dashboard: getElem('dashboard-view'),
        tasks: getElem('tasks-view'),
        meetingNotes: getElem('meeting-notes-view'),
    };

    // Main elements
    const taskList = getElem('task-list');
    const tagsList = getElem('tags-list');
    const paginationContainer = getElem('pagination-container');

    // Meeting Note Elements
    const folderTreeContainer = getElem('folder-tree-container');
    const newFolderBtn = getElem('new-folder-btn');

    // Inputs and buttons
    const taskSearchInput = getElem<HTMLInputElement>('task-search-input');
    const tagSearchInput = getElem<HTMLInputElement>('tag-search-input');
    const newTaskBtn = getElem('new-task-btn');
    const allTasksBtn = getElem('all-tasks-btn');

    // Modal elements
    const modal = getElem('task-modal');
    const modalTitle = getElem('modal-title');
    const taskForm = getElem<HTMLFormElement>('task-form');
    const taskIdInput = getElem<HTMLInputElement>('task-id-input');
    const taskTitleInput = getElem<HTMLInputElement>('task-title-input');
    const taskTagsInput = getElem<HTMLInputElement>('task-tags-input');
    const tagInputContainer = getElem('tag-input-container');
    const cancelBtn = getElem('cancel-btn');

    // Check for critical elements
    if (!taskList || !tagsList || !paginationContainer || !modal || !taskForm) {
        console.error('Critical UI elements are missing. Application cannot start.');
        return;
    }

    // --- HELPERS ---
    const formatDateTime = (isoString: string | null) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}-${month}-${year} ${hours}:${minutes}`;
    };

    const capitalize = (s: string) => {
        if (typeof s !== 'string' || s.length === 0) return '';
        return s.charAt(0).toUpperCase() + s.slice(1);
    };

    const createTagBadge = (tag: string) => {
        const badge = document.createElement('span');
        badge.className = 'tag-badge';
        badge.textContent = capitalize(tag);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'tag-delete-btn';
        deleteBtn.innerHTML = '&times;';
        badge.appendChild(deleteBtn);

        return badge;
    };

    // --- RENDER FUNCTIONS ---

    const renderTasks = (tasks: Task[]) => {
        taskList.innerHTML = '';
        if (tasks.length === 0) {
            taskList.innerHTML = '<p class="no-tasks">No tasks found.</p>';
            return;
        }

        tasks.forEach(task => {
            const taskItem = document.createElement('div');
            taskItem.className = `task-item ${task.status}`;
            taskItem.dataset.taskId = String(task.id);

            taskItem.innerHTML = `
                <div class="task-status">
                    <input type="checkbox" class="task-checkbox" ${task.status === 'completed' ? 'checked' : ''}>
                </div>
                <div class="task-details">
                    <p class="task-title">${task.title}</p>
                    <div class="task-meta">
                        <div class="task-tags">
                            ${task.tags.map(tag => `<span class="tag">${capitalize(tag)}</span>`).join('')}
                        </div>
                        <div class="task-dates">
                            <span class="date-created">Created: ${formatDateTime(task.created_date)}</span>
                            ${task.status === 'completed' ? `<span class="date-finished">Finished: ${formatDateTime(task.finished_date)}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="task-actions">
                    <button class="btn-icon edit-btn">✏️</button>
                    <button class="btn-icon delete-btn">🗑️</button>
                </div>
            `;
            taskList.appendChild(taskItem);
        });
    };

    const renderTags = (tags: string[]) => {
        tagsList.innerHTML = '';
        tags.forEach(tag => {
            const li = document.createElement('li');
            const button = document.createElement('button');
            button.className = 'tag-btn';
            button.textContent = capitalize(tag);
            button.dataset.tag = tag;
            if (tag === filterTag) {
                button.classList.add('active');
            }
            li.appendChild(button);
            tagsList.appendChild(li);
        });
    };

    const renderPagination = (total: number, page: number, limit: number) => {
        paginationContainer.innerHTML = '';
        const pageCount = Math.ceil(total / limit);
        if (pageCount <= 1) return;

        for (let i = 1; i <= pageCount; i++) {
            const button = document.createElement('button');
            button.className = 'pagination-btn';
            button.textContent = String(i);
            button.dataset.page = String(i);
            if (i === page) {
                button.classList.add('active');
            }
            paginationContainer.appendChild(button);
        }
    };

    // --- DATA FETCHING ---

    const fetchAndRenderData = async () => {
        try {
            const { tasks, total, page, limit } = await window.api.getTasks({ searchQuery, filterTag, page: currentPage });
            const allTags = await window.api.getTags();

            renderTasks(tasks);
            renderTags(allTags);
            renderPagination(total, page, limit);
            updateActiveTagButton();
        } catch (error) {
            console.error('Failed to fetch data:', error);
        }
    };

    // --- MODAL ---

    const openModal = (mode: 'create' | 'edit', task?: Partial<Task>) => {
        if (!modal || !modalTitle || !taskForm || !taskIdInput || !taskTitleInput || !tagInputContainer) return;
        modalTitle.textContent = mode === 'create' ? 'New Task' : 'Edit Task';
        taskForm.reset();

        // Clear existing tags
        tagInputContainer.querySelectorAll('.tag-badge').forEach(badge => badge.remove());

        if (mode === 'edit' && task) {
            taskIdInput.value = String(task.id || '');
            taskTitleInput.value = task.title || '';
            task.tags?.forEach(tag => {
                const badge = createTagBadge(tag);
                tagInputContainer.insertBefore(badge, taskTagsInput);
            });
        } else {
            taskIdInput.value = '';
        }
        modal.style.display = 'flex';
    };

    const closeModal = () => {
        if (modal) modal.style.display = 'none';
    };

    // --- Meeting Notes Renders ---

    const renderFolderTree = (parentId: string | null, level: number): HTMLUListElement => {
        const ul = document.createElement('ul');
        if (level === 0) ul.className = 'root-level';

        const children = meetingsData.folders.filter(f => f.parentId === parentId);

        children.forEach(folder => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="folder-item ${selectedFolderId === folder.id ? 'selected' : ''}" data-folder-id="${folder.id}">
                    <span class="folder-name-wrapper">
                        <span>📁</span>
                        <span class="folder-name">${folder.name}</span>
                    </span>
                    <span class="folder-actions">
                        <button class="btn-icon add-subfolder-btn" title="Add Subfolder">➕</button>
                    </span>
                </div>
            `;
            // Append children recursively
            if (meetingsData.folders.some(f => f.parentId === folder.id)) {
                li.appendChild(renderFolderTree(folder.id, level + 1));
            }
            ul.appendChild(li);
        });
        return ul;
    };

    const fetchAndRenderMeetingsData = async () => {
        meetingsData = await window.api.getAllMeetingsData();
        if (folderTreeContainer) {
            folderTreeContainer.innerHTML = '';
            folderTreeContainer.appendChild(renderFolderTree(null, 0));
        }
    };


    // --- EVENT HANDLERS ---

    const debounce = (func: Function, delay: number) => {
        let timeout: ReturnType<typeof setTimeout>;
        return function(this: any, ...args: any[]) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    };

    if (taskSearchInput) {
        taskSearchInput.addEventListener('input', debounce(() => {
            searchQuery = taskSearchInput.value;
            currentPage = 1;
            fetchAndRenderData();
        }, 300));
    }

    if (tagSearchInput) {
        tagSearchInput.addEventListener('input', () => {
            const query = tagSearchInput.value.toLowerCase();
            const tagButtons = tagsList.querySelectorAll('.tag-btn');
            tagButtons.forEach(button => {
                const li = button.parentElement!;
                const tag = button.textContent?.toLowerCase() || '';
                li.style.display = tag.includes(query) ? '' : 'none';
            });
        });
    }

    if (newTaskBtn) newTaskBtn.addEventListener('click', () => openModal('create'));
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (modal) modal.addEventListener('click', (e: MouseEvent) => {
        if (e.target === modal) closeModal();
    });

    // --- Tag Input Logic ---
    if (tagInputContainer) {
        tagInputContainer.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.matches('.tag-delete-btn')) {
                target.parentElement?.remove();
            } else {
                taskTagsInput?.focus();
            }
        });
    }

    if (taskTagsInput) {
        taskTagsInput.addEventListener('keydown', (e) => {
            if (e.key === ',' || e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                const tagText = taskTagsInput.value.trim();
                if (tagText) {
                    const badge = createTagBadge(tagText);
                    tagInputContainer?.insertBefore(badge, taskTagsInput);
                    taskTagsInput.value = '';
                }
            }
        });
    }

    taskForm.addEventListener('submit', async (e: Event) => {
        e.preventDefault();
        if (!taskTitleInput || !tagInputContainer || !taskIdInput) return;

        const title = taskTitleInput.value;
        const tags = Array.from(tagInputContainer.querySelectorAll('.tag-badge'))
            .map(badge => badge.textContent?.slice(0, -1).trim() || '') // slice to remove '×'
            .filter(Boolean);

        // --- VALIDATION ---
        if (!title.trim()) {
            alert('Title is required.');
            return;
        }
        if (tags.length === 0) {
            alert('At least one tag is required.');
            return;
        }

        const id = taskIdInput.value ? Number(taskIdInput.value) : null;

        try {
            if (id) {
                await window.api.updateTask(id, { title, tags });
            } else {
                await window.api.createTask({ title, tags });
            }
            closeModal();
            fetchAndRenderData();
        } catch (error) {
            console.error('Failed to save task:', error);
        }
    });

    taskList.addEventListener('click', async (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const taskItem = target.closest<HTMLElement>('.task-item');
        if (!taskItem || !taskItem.dataset.taskId) return;

        const id = Number(taskItem.dataset.taskId);

        if (target.matches('.task-checkbox')) {
            const isChecked = (target as HTMLInputElement).checked;
            await window.api.updateTask(id, { status: isChecked ? 'completed' : 'pending' });
            fetchAndRenderData();
        }

        if (target.matches('.edit-btn')) {
            const titleEl = taskItem.querySelector('.task-title');
            const tagsEl = taskItem.querySelectorAll('.tag');
            if (titleEl) {
                const title = titleEl.textContent || '';
                const tags = Array.from(tagsEl).map(t => t.textContent || '').filter(Boolean);
                openModal('edit', { id, title, tags });
            }
        }

        if (target.matches('.delete-btn')) {
            if (confirm('Are you sure you want to delete this task?')) {
                await window.api.deleteTask(id);
                fetchAndRenderData();
            }
        }
    });

    tagsList.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.matches('.tag-btn') && (target as HTMLButtonElement).dataset.tag) {
            filterTag = (target as HTMLButtonElement).dataset.tag!;
            currentPage = 1;
            fetchAndRenderData();
        }
    });

    if (allTasksBtn) {
        allTasksBtn.addEventListener('click', () => {
            filterTag = '';
            currentPage = 1;
            fetchAndRenderData();
        });
    }

    const updateActiveTagButton = () => {
        document.querySelectorAll('.sidebar .tag-btn').forEach(btn => {
            const button = btn as HTMLButtonElement;
            const isAllTasks = !filterTag && button.id === 'all-tasks-btn';
            const isMatchingTag = filterTag && button.dataset.tag === filterTag;
            button.classList.toggle('active', !!(isAllTasks || isMatchingTag));
        });
    };

    paginationContainer.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.matches('.pagination-btn') && (target as HTMLButtonElement).dataset.page) {
            currentPage = Number((target as HTMLButtonElement).dataset.page);
            fetchAndRenderData();
        }
    });

    // --- Tab Switching Logic ---
    const activateTab = (tabName: keyof typeof views) => {
        Object.values(tabButtons).forEach(btn => btn?.classList.remove('active'));
        Object.values(views).forEach(view => {
            if (view) view.style.display = 'none';
        });

        tabButtons[tabName]?.classList.add('active');
        if (views[tabName]) views[tabName]!.style.display = 'block';

        if (tabName === 'meetingNotes') {
            fetchAndRenderMeetingsData();
        }
    };

    Object.entries(tabButtons).forEach(([tabName, tabButton]) => {
        if (tabButton) {
            tabButton.addEventListener('click', () => activateTab(tabName as keyof typeof views));
        }
    });

    // --- Meeting Notes Event Handlers ---
    if (newFolderBtn) {
        newFolderBtn.addEventListener('click', async () => {
            const name = prompt('Enter new folder name:');
            if (name) {
                await window.api.createFolder({ name, parentId: null });
                fetchAndRenderMeetingsData();
            }
        });
    }

    if (folderTreeContainer) {
        folderTreeContainer.addEventListener('click', async (e) => {
            const target = e.target as HTMLElement;
            const folderItem = target.closest('.folder-item');
            const folderId = folderItem?.dataset.folderId;

            // Handle adding a subfolder
            if (target.matches('.add-subfolder-btn')) {
                e.stopPropagation(); // Prevent folder selection
                const name = prompt('Enter new sub-folder name:');
                if (name && folderId) {
                    await window.api.createFolder({ name, parentId: folderId });
                    fetchAndRenderMeetingsData();
                }
                return;
            }

            // Handle selecting a folder
            if (folderId) {
                selectedFolderId = folderId;
                // Re-render the tree to show the new selection
                fetchAndRenderMeetingsData();
                // TODO: In Part C, this will also render the notes for this folder.
            }
        });
    }

    // --- Dashboard Widget Logic ---
    const widgetTasks = getElem('widget-tasks');
    const widgetMeetingNotes = getElem('widget-meeting-notes');

    if (widgetTasks) {
        widgetTasks.addEventListener('click', () => activateTab('tasks'));
    }
    if (widgetMeetingNotes) {
        widgetMeetingNotes.addEventListener('click', () => activateTab('meetingNotes'));
    }

    // --- INITIAL LOAD ---
    // Load data for the default tab (Tasks)
    fetchAndRenderData();
});
