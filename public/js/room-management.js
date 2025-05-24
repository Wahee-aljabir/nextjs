document.addEventListener('DOMContentLoaded', function() {
    // Toggle user selection visibility
    const privateToggle = document.getElementById('is-private');
    const userSelection = document.getElementById('user-selection');

    privateToggle.addEventListener('change', function() {
        userSelection.classList.toggle('hidden', !this.checked);
        if (this.checked && !userSelection.hasAttribute('data-loaded')) {
            fetchUsers();
            userSelection.setAttribute('data-loaded', 'true');
        }
    });

    // Fetch users for selection
    async function fetchUsers() {
        const token = localStorage.getItem('token');
        try {
            const response = await fetch('/users', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) throw new Error('Failed to fetch users');
            const users = await response.json();
            populateUserSelect(users);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    }

    // Populate user selection dropdown
    function populateUserSelect(users) {
        const select = document.getElementById('allowed-users');
        const currentUser = JSON.parse(localStorage.getItem('user'));
        
        users.forEach(user => {
            if (user.id !== currentUser.id) { // Don't include current user
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = user.username;
                select.appendChild(option);
            }
        });
    }

    // Update the form submission handler
    document.getElementById('create-room-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const token = localStorage.getItem('token');
        const formData = {
            name: document.getElementById('room-name').value,
            description: document.getElementById('room-description').value,
            isPrivate: document.getElementById('is-private').checked,
            allowedUsers: []
        };
    
        // If private room, get selected users
        if (formData.isPrivate) {
            const selectedOptions = document.getElementById('allowed-users').selectedOptions;
            formData.allowedUsers = Array.from(selectedOptions).map(option => parseInt(option.value));
        }
    
        try {
            const response = await fetch('/create-room', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });
    
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create room');
            }
    
            const result = await response.json();
            if (result.success) {
                window.location.href = '/chat.html';
            }
        } catch (error) {
            console.error('Error creating room:', error);
            alert('Failed to create room: ' + error.message);
        }
    });
});