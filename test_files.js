import { invoke } from '@tauri-apps/api/core';
invoke('read_dir_shallow', { path: 'sys:desktop' }).then(console.log).catch(console.error);
