export const getFileIcon = (type) => {
  switch (type) {
    case 'folder':
      return <svg viewBox="0 0 24 24" width="28" height="28" fill="#ffd54f"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>;
    case 'pdf':
      return <svg viewBox="0 0 24 24" width="28" height="28" fill="#ef5350"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM14 11h1V8.5h-1V11z"/></svg>;
    case 'excel':
      return <svg viewBox="0 0 24 24" width="28" height="28" fill="#66bb6a"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 14h-2.5l-1.5-2.5-1.5 2.5H8l2.5-3.5L8 9h2.5l1.5 2.5L13.5 9H16l-2.5 3.5L16 16zm-3-9V3.5L18.5 9H13z"/></svg>;
    case 'word':
      return <svg viewBox="0 0 24 24" width="28" height="28" fill="#42a5f5"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1.8 14l-1.4-3.5L9.4 16H7.8l2.2-5h1.6l1.2 3.3 1.2-3.3h1.6l2.2 5h-1.6l-1.4-3.5L13.8 16h-1.6zm.8-9V3.5L18.5 9H13z"/></svg>;
    case 'image':
      return <svg viewBox="0 0 24 24" width="28" height="28" fill="#29b6f6"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>;
    case 'video':
      return <svg viewBox="0 0 24 24" width="28" height="28" fill="#ab47bc"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-2zM9 16V9l7 3.5L9 16z"/></svg>;
    case 'ppt':
      return <svg viewBox="0 0 24 24" width="28" height="28" fill="#ffa726"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-3.5 14H9v-5h1.5v5zm.75-6.5c-.41 0-.75-.34-.75-.75s.34-.75.75-.75.75.34.75.75-.34.75-.75.75zM13 9V3.5L18.5 9H13z"/></svg>;
    default:
      return <svg viewBox="0 0 24 24" width="28" height="28" fill="#9e9e9e"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/></svg>;
  }
};
