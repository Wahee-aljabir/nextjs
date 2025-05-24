document.addEventListener("DOMContentLoaded", () => {
  const signinForm = document.getElementById("signin-form") || document.getElementById("sign-in-form");
  const signupForm = document.getElementById("signup-form") || document.getElementById("sign-up-form");

  console.log("Auth.js loaded");
  console.log("Signin form:", signinForm);
  console.log("Signup form:", signupForm);

  if (signinForm) {
    signinForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = document.getElementById("signin-username") || document.getElementById("username");
      const password = document.getElementById("signin-password") || document.getElementById("password");

      console.log("Signing in with:", username.value, password.value);

      try {
        const res = await fetch("http://localhost:3000/signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username.value.trim(), password: password.value.trim() }),
        });

        const data = await res.json();
        console.log("Sign in response:", data);

        // In signin form handler
        if (!res.ok) {
          alert(data.error || "Sign in failed.");
          return;
        }
        localStorage.setItem("userId", data.userId);
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify({
          id: data.userId,
          username: data.username
        }));
        window.location.href = "chat.html";
      
      } catch (err) {
        console.error("Sign in error:", err);
        alert("Sign in error");
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = document.getElementById("signup-username") || document.getElementById("username");
      const password = document.getElementById("signup-password") || document.getElementById("password");

      console.log("Signing up with:", username.value, password.value);

      try {
        const res = await fetch("http://localhost:3000/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username.value.trim(), password: password.value.trim() }),
        });

        const data = await res.json();
        console.log("Sign up response:", data);

        // In signup form handler
        if (res.ok) {
          localStorage.setItem("userId", data.userId);
          localStorage.setItem("token", data.token);
          localStorage.setItem("user", JSON.stringify({
            id: data.userId,
            username: username.value
          }));
          window.location.href = "chat.html";
        } else {
          alert(data.error || "Sign up failed.");
        }
      } catch (err) {
        console.error("Sign up error:", err);
        alert("Sign up error");
      }
    });
  }
});