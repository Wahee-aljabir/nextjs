document.getElementById('signin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/signin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify({
                id: data.userId,
                username: data.username
            }));

            // Check for redirect path
            const redirectPath = localStorage.getItem('redirectAfterLogin') || '/chat.html';
            localStorage.removeItem('redirectAfterLogin'); // Clean up
            window.location.href = redirectPath;
        } else {
            alert(data.error || 'Failed to sign in');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to sign in');
    }
});