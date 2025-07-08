# Modal System Usage Guide

The application now uses a custom modal system that replaces native browser dialogs with themed modals.

## Setup

The modal system is already set up in `main.jsx` with the `ModalProvider`. To use it in any component:

```jsx
import { useModal } from '../../context/modal-context';

function MyComponent() {
  const modal = useModal();
  // ... use modal methods
}
```

## Available Methods

### 1. Basic Alert
```jsx
// Simple alert
await modal.alert('This is a message');

// Alert with custom title
await modal.alert('Operation completed successfully!', 'Success');

// Alert with type (info, warning, error, success)
await modal.alert('Please check your input', 'Validation Error', 'error');
```

### 2. Confirmation Dialog
```jsx
// Basic confirmation
const confirmed = await modal.confirm('Are you sure you want to proceed?');
if (confirmed) {
  // User clicked "Confirm"
}

// Confirmation with custom title
const confirmed = await modal.confirm(
  'This will permanently delete all data', 
  'Delete Confirmation'
);
```

### 3. Delete Confirmation (Special Case)
```jsx
// Delete confirmation with item name
const confirmed = await modal.confirmDelete('User Profile');
// Shows: "Are you sure you want to delete "User Profile"? This action cannot be undone."

// Delete confirmation with custom message
const confirmed = await modal.confirmDelete(
  'Team Alpha',
  'This will delete the team and free up all members to join other teams.'
);
```

### 4. Custom Modal
```jsx
// Fully custom modal with custom buttons
await modal.showModal({
  title: 'Custom Action',
  message: 'Choose an action to perform:',
  type: 'info',
  buttons: [
    { 
      label: 'Cancel', 
      variant: 'outline',
      action: () => console.log('Cancelled')
    },
    { 
      label: 'Save Draft', 
      variant: 'secondary',
      action: () => saveDraft()
    },
    { 
      label: 'Publish', 
      variant: 'default',
      action: () => publish()
    }
  ]
});
```

## Migration from window.confirm/alert

Replace native dialogs with the modal system:

```jsx
// Before
if (window.confirm('Delete this item?')) {
  deleteItem();
}

// After
const confirmed = await modal.confirm('Delete this item?');
if (confirmed) {
  deleteItem();
}
```

```jsx
// Before
window.alert('Operation completed!');

// After
await modal.alert('Operation completed!', 'Success', 'success');
```

## Modal Types and Styling

The modal system supports different types that affect the icon and color:
- `info` - Blue info icon (default)
- `warning` - Yellow warning icon
- `error` - Red error icon
- `success` - Green checkmark icon

## Button Variants

Available button variants:
- `default` - Primary button style
- `destructive` - Red button for dangerous actions
- `outline` - Bordered button
- `secondary` - Secondary button style
- `ghost` - Minimal button style

## Notes

1. All modal methods return Promises, so use `await` or `.then()`
2. The modal automatically handles dark/light theme
3. Modals can be closed with ESC key or clicking the backdrop
4. The confirmDelete method automatically uses the destructive button variant
5. Custom modals can have any number of buttons with custom actions