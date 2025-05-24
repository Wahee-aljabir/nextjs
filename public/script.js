document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');

  app.innerHTML = `
    <h2 class="text-2xl font-semibold mb-4 text-center">Sign In</h2>
    <input class="input mb-3" type="text" placeholder="Username" id="username" />
    <input class="input mb-4" type="password" placeholder="Password" id="password" />
    <button class="btn-primary w-full">Sign In</button>
    <p class="text-sm text-center mt-4">Don't have an account? <a href="#" class="text-blue-600">Sign Up</a></p>
  `;
});
