function protectRoute() {
    const token = localStorage.getItem('token');
    if (!token) {
        // Store the intended destination
        localStorage.setItem('redirectAfterLogin', window.location.pathname);
        window.location.href = '/index.html';
    }
}

document.addEventListener('DOMContentLoaded', protectRoute);