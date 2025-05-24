// chat.js

// Add Pusher client setup first
const pusher = new Pusher('28e44a48a94c5b1504fd', {
  cluster: 'eu'
});

// Helper function to add message to UI
// Update the addMessageToUI function
function addMessageToUI(msg) {
    const messagesContainer = document.getElementById('messages');
    const msgDiv = document.createElement('div');
    const user = JSON.parse(localStorage.getItem('user'));
    const isMine = user && msg.username === user.username;

    console.log('addMessageToUI called');
    console.log('Message:', msg);
    console.log('Current User:', user);
    console.log('Is Mine:', isMine);

    const messageClasses = [
        'p-2', 'rounded', 'mb-2', 'max-w-[75%]', 'break-words', 'shadow', 'flex', 'flex-col',
        ...(isMine
            ? ['bg-blue-100', 'text-blue-900', 'self-end'] // Your messages
            : ['bg-green-100', 'text-green-900', 'self-start'] // Other users' messages
        )
    ];

    console.log('Applied Classes:', messageClasses);

    msgDiv.classList.add(...messageClasses);

    msgDiv.innerHTML = `
        <span class="font-bold ${isMine ? 'text-right' : 'text-left'}">${msg.username}</span>
        <span class="${isMine ? 'text-right' : 'text-left'}">${msg.message}</span>
    `;

    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function loadRoomMessages(roomId) {
    try {
        console.log('loadRoomMessages called');
        const token = localStorage.getItem('token');
        const response = await fetch(`/messages/${roomId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const messages = await response.json();
        console.log('DB FETCHED:', messages);

        const messageContainer = document.getElementById('messages');
        if (!messageContainer) {
            console.error('Messages container not found!');
            return;
        }
        messageContainer.innerHTML = '';

        // Use addMessageToUI for consistent styling and alignment
        messages.forEach(message => {
            console.log('Processing message:', message);
            addMessageToUI(message);
        });

        messageContainer.scrollTop = messageContainer.scrollHeight;

        // Subscribe to new messages for this room
        if (window.currentChannel) {
            window.currentChannel.unsubscribe();
        }
        window.currentChannel = pusher.subscribe(`room-${roomId}`);
        window.currentChannel.bind('new-message', message => {
            console.log('PUSHER EVENT:', message); // <-- Log every message from Pusher
            // Prevent duplicate messages by checking timestamp and username
            const messagesContainer = document.getElementById('messages');
            const lastMsg = messagesContainer.lastElementChild;
            if (
                lastMsg &&
                lastMsg.textContent &&
                lastMsg.textContent.includes(message.username) &&
                lastMsg.textContent.endsWith(message.message)
            ) {
                // Duplicate, do not add
                return;
            }
            addMessageToUI({
                username: message.username,
                message: message.message,
                timestamp: message.timestamp
            });
        });

        // Store current room ID
        currentRoomId = roomId;  // Update the variable
        localStorage.setItem('current-room-id', roomId);
        
    } catch (error) {
        console.error('Error loading messages:', error);
        throw new Error('Failed to load messages');
    }
}

// Update the room display function
function displayRooms(rooms) {
    const roomList = document.getElementById('room-list');
    roomList.innerHTML = '';

    if (rooms.length === 0) {
        roomList.innerHTML = '<p class="text-gray-400">No rooms available</p>';
        return;
    }

    const currentUser = JSON.parse(localStorage.getItem('user'));

    rooms.forEach(room => {
        const roomItem = document.createElement('div');
        roomItem.classList.add('bg-gray-700', 'p-2', 'rounded', 'flex', 'items-center', 'justify-between', 'cursor-pointer', 'hover:bg-gray-600', 'mb-2');

        // Room name area
        const roomNameDiv = document.createElement('div');
        roomNameDiv.classList.add('flex-1', 'truncate');
        roomNameDiv.textContent = room.name;
        roomNameDiv.addEventListener('click', (e) => {
            if (e.target.closest('.leave-btn')) return;
            currentRoomId = room.id;
            joinRoom(room.id);
        });

        roomItem.appendChild(roomNameDiv);

        // Only show leave button if not the owner
        if (room.user_id !== currentUser.id) {
            const leaveBtn = document.createElement('button');
            leaveBtn.textContent = 'Leave';
            leaveBtn.className = 'leave-btn btn btn-xs btn-error ml-2';
            leaveBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const confirmLeave = confirm(`Are you sure you want to leave "${room.name}"?`);
                if (confirmLeave) {
                    await leaveRoom(room.id);
                    if (currentRoomId === room.id) {
                        document.getElementById('chat-interface').classList.add('hidden');
                    }
                    fetchRooms();
                }
            });
            roomItem.appendChild(leaveBtn);
        }

        roomList.appendChild(roomItem);
    });
}

// Add this function to handle leaving a room
async function leaveRoom(roomId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/rooms/${roomId}/leave`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) throw new Error('Failed to leave room');
    } catch (error) {
        alert('Error leaving room: ' + error.message);
    }
}

// Update message form handler
document.getElementById('message-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentRoomId) return;

    const messageInput = document.getElementById('message-input');
    const message = messageInput.value.trim();
    if (!message) return;

    console.log('Message form submitted');
    console.log('Message to send:', message);

    try {
        const response = await fetch('/message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ 
                roomId: currentRoomId,
                message,
                username: JSON.parse(localStorage.getItem('user')).username
            }),
        });

        if (!response.ok) throw new Error('Failed to send message');
        const data = await response.json();
        if (data.success) {
            console.log('Message sent successfully');
            // Add the message to the UI immediately
            addMessageToUI({
                username: JSON.parse(localStorage.getItem('user')).username,
                message: message
            });
            messageInput.value = '';
        }
    } catch (error) {
        console.error('Error sending message:', error);
    }
});

// Add at the top after Pusher setup
let currentRoomId = null;

// Add this function to fetch rooms
async function fetchRooms() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/rooms', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to fetch rooms');
        
        const rooms = await response.json();
        displayRooms(rooms);
    } catch (error) {
        console.error('Error fetching rooms:', error);
    }
}

// Add the joinRoom function
async function joinRoom(roomId) {
    try {
        const chatInterface = document.getElementById('chat-interface');
        chatInterface.classList.remove('hidden');
        
        const response = await fetch(`/room/${roomId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) throw new Error('Failed to fetch room details');
        
        const room = await response.json();
        
        // Set room name (bold)
        document.getElementById('room-name').textContent = room.name;

        // Set participants and owner (not bold, less noticeable)
        let usersText = '';
        if (room.users && room.users.length > 0) {
            usersText = `(participants: ${room.users.map(u => u.username).join(', ')}`;
        }
        let ownerText = '';
        if (room.owner_username) {
            ownerText = ` Owner: ${room.owner_username})`;
        }
        document.getElementById('room-participants').textContent = usersText + ownerText;

        document.getElementById('room-description').textContent = room.description;
        
        // Load messages
        await loadRoomMessages(roomId);
    } catch (error) {
        console.error('Error joining room:', error);
    }
}

// Add event listener to load rooms when page loads
window.addEventListener('DOMContentLoaded', () => {
    fetchRooms();

    // Show signed-in user in the top left
    const user = JSON.parse(localStorage.getItem('user'));
    if (user && user.username) {
        document.getElementById('signed-in-user').textContent = `Signed in as: ${user.username}`;
    }

    // Logout button functionality
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'index.html';
    });
});

// Room menu functionality
const roomMenuBtn = document.getElementById('room-menu-btn');
const roomMenu = document.getElementById('room-menu');
const manageMembersBtn = document.getElementById('manage-members-btn');
const manageMembersModal = document.getElementById('manage-members-modal');
const closeModalBtn = document.getElementById('close-modal');
const newMemberInput = document.getElementById('new-member-input');
const memberError = document.getElementById('member-error');

// Toggle menu
console.log('roomMenuBtn:', roomMenuBtn);
console.log('roomMenu:', roomMenu);

if (roomMenuBtn && roomMenu) {
  roomMenuBtn.addEventListener('click', (e) => {
    console.log('roomMenuBtn clicked');
    e.stopPropagation();
    console.log('roomMenu before toggle:', roomMenu);
    roomMenu.classList.toggle('hidden');
    console.log('roomMenu after toggle:', roomMenu.classList);
  });

  document.addEventListener('click', () => {
    console.log('document clicked, hiding menu');
    roomMenu.classList.add('hidden');
  });
} else {
  if (!roomMenuBtn) console.warn('roomMenuBtn is null');
  if (!roomMenu) console.warn('roomMenu is null');
}

// Manage members modal
if (manageMembersBtn && manageMembersModal) {
  manageMembersBtn.addEventListener('click', () => {
    manageMembersModal.classList.remove('hidden');
    loadCurrentMembers();
  });
} else {
  if (!manageMembersBtn) console.warn('manageMembersBtn is null');
  if (!manageMembersModal) console.warn('manageMembersModal is null');
}

if (closeModalBtn && manageMembersModal) {
  closeModalBtn.addEventListener('click', () => {
    manageMembersModal.classList.add('hidden');
  });
} else {
  if (!closeModalBtn) console.warn('closeModalBtn is null');
  if (!manageMembersModal) console.warn('manageMembersModal is null');
}

// Add new member
newMemberInput.addEventListener('keypress', async (e) => {
  if (e.key === 'Enter') {
    const username = newMemberInput.value.trim();
    if (!username) return;

    try {
      const response = await fetch(`/room/${currentRoomId}/add-member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ username })
      });

      const data = await response.json();
      
      if (response.ok) {
        newMemberInput.value = '';
        memberError.classList.add('hidden');
        loadCurrentMembers();
      } else {
        memberError.textContent = data.error;
        memberError.classList.remove('hidden');
      }
    } catch (error) {
      console.error('Error adding member:', error);
      memberError.textContent = 'Failed to add member';
      memberError.classList.remove('hidden');
    }
  }
});

async function loadCurrentMembers() {
  try {
    const response = await fetch(`/room/${currentRoomId}/members`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (response.ok) {
      const members = await response.json();
      const membersContainer = document.getElementById('current-members');
      membersContainer.innerHTML = members.map(member => `
        <div class="flex items-center justify-between py-2">
          <span>${member.username}</span>
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('Error loading members:', error);
  }
}