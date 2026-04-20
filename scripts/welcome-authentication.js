const form = document.querySelector('form');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const toggleIcon = document.querySelector('.input-wrap svg');

if (toggleIcon && passwordInput) {
  toggleIcon.addEventListener('click', () => {
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    toggleIcon.setAttribute('fill', isHidden ? '#4f46e5' : '#e3e3e3');
  });
}

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email) {
      alert('Please enter your email address.');
      emailInput.focus();
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      alert('Please enter a valid email address.');
      emailInput.focus();
      return;
    }

    if (!password) {
      alert('Please enter your password.');
      passwordInput.focus();
      return;
    }

    // Make API call to login
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        alert('Login successful!');
        localStorage.setItem('token', data.token); // Store JWT token
        // Optionally redirect to gallery page
        // window.location.href = 'gallery.html';
      } else {
        alert(data.message || 'Login failed');
      }
    } catch (error) {
      alert('An error occurred. Please try again.');
      console.error('Login error:', error);
    }

    form.reset();
    passwordInput.type = 'password';
  });
}

document.getElementById('google-login').addEventListener('click', () => {
  window.location.href = 'https://accounts.google.com';
});

document.getElementById('apple-login').addEventListener('click', () => {
  window.location.href = 'https://appleid.apple.com/signin';
});
