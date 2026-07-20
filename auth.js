// ---------------------------------------------------------------------
// YCTAS! Plan 2 — Optional accounts (Firebase)
//
// This whole file is additive. If anything here fails to load (e.g. the
// Firebase CDN scripts didn't load), the rest of the app must keep working
// exactly as it does with no login at all — nothing in tester.js or app.js
// depends on this file being present.
//
// IMPORTANT: this login is SHARED across all of YCTAS! (Plan 1, Plan 2,
// future plans) — the Firebase project itself ("YCTAS-Accounts") is not
// Plan-2-specific. To keep it that way, this plan's cloud data lives in
// its own labeled compartment inside each account doc (see PLAN_KEY
// below), not at the top level — so when Plan 1 or a future plan connects
// to this same account system, its progress data gets its own compartment
// instead of overwriting this one. Data model in Firestore: collection
// "users", one doc per account, keyed by their Firebase uid; each plan
// writes only to its own key within that doc.
// ---------------------------------------------------------------------

// Formspree endpoint — delivers each "Questions? Contact us" submission
// straight to info@thespanishfluencycentre.com as a normal email. The
// Firestore "support_requests" collection is kept as a backup copy
// alongside it, in case an email ever gets lost or filtered.
const CONTACT_FORM_ENDPOINT = 'https://formspree.io/f/mykrjaqn';

const firebaseConfig = {
  apiKey: "AIzaSyB2BQl-_R8tcDMLR1eiT_4WNQ02A41LC10",
  authDomain: "yctas-accounts.firebaseapp.com",
  projectId: "yctas-accounts",
  storageBucket: "yctas-accounts.firebasestorage.app",
  messagingSenderId: "354556714194",
  appId: "1:354556714194:web:58ee2d01010608cc09610b"
};

// Same keys tester.js uses — kept in sync deliberately so both files agree
// on where local progress lives, without tester.js needing to know
// anything about accounts.
const STORAGE_KEY = 'yctas_plan2_tester_v1';
const STREAK_KEY = 'yctas_plan2_streaks_v1';
const DAILY_STREAK_KEY = 'yctas_plan2_dailystreak_v1';

(function () {

  // If the Firebase scripts didn't load (offline, blocked domain, etc.),
  // quietly disable accounts for this visit rather than breaking the app.
  if (typeof firebase === 'undefined') {
    console.warn('YCTAS accounts: Firebase SDK not available — continuing without login.');
    window.YCTASAuth = {
      isLoggedIn: () => false,
      pushProgress: () => {},
    };
    return;
  }

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  let currentUser = null;
  let pushTimer = null;

  // ---------- local storage helpers (read-only from this file's point of view) ----------
  function readLocal(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return fallback;
  }
  function writeLocal(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function readAllLocal() {
    return {
      progress: readLocal(STORAGE_KEY, {}),
      streaks: readLocal(STREAK_KEY, { pop: { current: 0, best: 0 }, area: { current: 0, best: 0 } }),
      dailyStreak: readLocal(DAILY_STREAK_KEY, { current: 0, lastDate: null }),
    };
  }
  function writeAllLocal(data) {
    if (data.progress) writeLocal(STORAGE_KEY, data.progress);
    if (data.streaks) writeLocal(STREAK_KEY, data.streaks);
    if (data.dailyStreak) writeLocal(DAILY_STREAK_KEY, data.dailyStreak);
  }

  // ---------- merge logic ----------
  // Combines a device's local progress with whatever's already saved to an
  // account, so signing in never throws away progress on either side.
  function mergeProgress(a, b) {
    const out = {};
    const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    keys.forEach(key => {
      const datesA = (a && a[key] && a[key].correctDates) || [];
      const datesB = (b && b[key] && b[key].correctDates) || [];
      out[key] = { correctDates: Array.from(new Set([...datesA, ...datesB])).sort() };
    });
    return out;
  }
  function mergeStreakMode(a, b) {
    const cur = Math.max(Number(a && a.current) || 0, Number(b && b.current) || 0);
    let best = Math.max(Number(a && a.best) || 0, Number(b && b.best) || 0);
    if (best < cur) best = cur;
    return { current: cur, best };
  }
  function mergeStreaks(a, b) {
    return { pop: mergeStreakMode(a && a.pop, b && b.pop), area: mergeStreakMode(a && a.area, b && b.area) };
  }
  function mergeDailyStreak(a, b) {
    if (!a || !a.lastDate) return b || { current: 0, lastDate: null };
    if (!b || !b.lastDate) return a;
    if (a.lastDate === b.lastDate) return { current: Math.max(a.current, b.current), lastDate: a.lastDate };
    // Different days — trust whichever record is more recent; its streak
    // count is the one still "live."
    return a.lastDate > b.lastDate ? a : b;
  }
  function mergeAll(local, remote) {
    return {
      progress: mergeProgress(local.progress, remote.progress),
      streaks: mergeStreaks(local.streaks, remote.streaks),
      dailyStreak: mergeDailyStreak(local.dailyStreak, remote.dailyStreak),
    };
  }

  // ---------- cloud sync ----------
  // Each plan gets its own labeled compartment inside the shared account
  // doc (e.g. "plan2", later "plan1") so different plans sharing the same
  // login never overwrite each other's progress.
  const PLAN_KEY = 'plan2';

  async function pushProgress(data) {
    if (!currentUser) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(async () => {
      try {
        await db.collection('users').doc(currentUser.uid).set({
          [PLAN_KEY]: {
            progress: data.progress, streaks: data.streaks, dailyStreak: data.dailyStreak,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
        }, { merge: true });
      } catch (e) { console.warn('YCTAS accounts: cloud sync failed, will retry on next change.', e); }
    }, 800);
  }

  async function mergeAndSync(uid) {
    const local = readAllLocal();
    let remote = {};
    try {
      const snap = await db.collection('users').doc(uid).get();
      if (snap.exists) remote = (snap.data() || {})[PLAN_KEY] || {};
    } catch (e) { console.warn('YCTAS accounts: could not read cloud progress, using local only.', e); }

    const merged = mergeAll(local, remote);
    writeAllLocal(merged);
    try {
      await db.collection('users').doc(uid).set({
        [PLAN_KEY]: {
          progress: merged.progress, streaks: merged.streaks, dailyStreak: merged.dailyStreak,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
      }, { merge: true });
    } catch (e) { console.warn('YCTAS accounts: could not write merged progress to cloud yet.', e); }

    // Let tester.js know progress may have changed under it, in case the
    // Practice & Games screen is already open right now.
    window.dispatchEvent(new CustomEvent('yctas:progressMerged'));
  }

  // ---------- public API used by tester.js ----------
  window.YCTASAuth = {
    isLoggedIn: () => !!currentUser,
    getUser: () => currentUser,
    pushProgress,
  };

  // ---------- UI ----------
  let modalOpen = false;
  let mode = 'signin'; // 'signin' | 'signup'

  function el(tag, props, ...kids) {
    const node = document.createElement(tag);
    Object.assign(node, props || {});
    kids.forEach(k => node.appendChild(typeof k === 'string' ? document.createTextNode(k) : k));
    return node;
  }

  function friendlyError(code) {
    const map = {
      'auth/email-already-in-use': 'That email already has an account — try logging in instead.',
      'auth/invalid-email': 'That email address doesn\u2019t look right.',
      'auth/weak-password': 'Please use at least 6 characters for the password.',
      'auth/wrong-password': 'That password doesn\u2019t match this email.',
      'auth/user-not-found': 'No account found for that email.',
      'auth/too-many-requests': 'Too many attempts — please wait a moment and try again.',
    };
    return map[code] || 'Something went wrong. Please try again.';
  }

  function buildModal() {
    const overlay = el('div', { className: 'acct-overlay' });
    const box = el('div', { className: 'acct-box' });

    const closeBtn = el('button', { className: 'acct-close', textContent: '✕' });
    closeBtn.addEventListener('click', closeModal);

    const title = el('h2', { className: 'acct-title', textContent: mode === 'signup' ? 'Create an account' : 'Log in' });
    const sub = el('p', { className: 'acct-sub' },
      'Optional — this just lets your progress follow you between your own devices.');

    const errorBox = el('div', { className: 'acct-error hidden' });

    const emailInput = el('input', { className: 'acct-input', type: 'email', placeholder: 'Email', autocomplete: 'email' });
    const passInput = el('input', { className: 'acct-input', type: 'password', placeholder: 'Password', autocomplete: mode === 'signup' ? 'new-password' : 'current-password' });

    const childInput = el('input', { className: 'acct-input', type: 'text', placeholder: "Child's display name (optional)", maxLength: 40 });

    const disclosureRow = el('label', { className: 'acct-checkbox-row' });
    const disclosureCheck = el('input', { type: 'checkbox', checked: false });
    disclosureRow.appendChild(disclosureCheck);
    disclosureRow.appendChild(el('span', {}, 'Send me occasional emails about app updates.'));

    const submitBtn = el('button', { className: 'acct-submit', textContent: mode === 'signup' ? 'Create account' : 'Log in' });

    const switchRow = el('p', { className: 'acct-switch' });
    if (mode === 'signup') {
      switchRow.appendChild(document.createTextNode('Already have an account? '));
      const link = el('a', { href: '#', textContent: 'Log in' });
      link.addEventListener('click', (e) => { e.preventDefault(); mode = 'signin'; renderModal(); });
      switchRow.appendChild(link);
    } else {
      switchRow.appendChild(document.createTextNode("New here? "));
      const link = el('a', { href: '#', textContent: 'Create an account' });
      link.addEventListener('click', (e) => { e.preventDefault(); mode = 'signup'; renderModal(); });
      switchRow.appendChild(link);
    }

    const forgotRow = el('p', { className: 'acct-switch' });
    const forgotLink = el('a', { href: '#', textContent: 'Forgot your password?' });
    forgotLink.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();
      if (!email) { showError('Type your email above first, then tap this link.'); return; }
      try {
        await auth.sendPasswordResetEmail(email);
        showError('Password reset email sent — check your inbox.', true);
      } catch (err) { showError(friendlyError(err.code)); }
    });
    forgotRow.appendChild(forgotLink);

    function showError(msg, ok) {
      errorBox.textContent = msg;
      errorBox.className = 'acct-error' + (ok ? ' ok' : '');
    }

    submitBtn.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      const password = passInput.value;
      if (!email || !password) { showError('Please fill in both fields.'); return; }
      submitBtn.disabled = true;
      submitBtn.textContent = 'Please wait\u2026';
      try {
        if (mode === 'signup') {
          const cred = await auth.createUserWithEmailAndPassword(email, password);
          await db.collection('users').doc(cred.user.uid).set({
            email, marketingOptIn: !!disclosureCheck.checked,
            childName: childInput.value.trim() || null,
          }, { merge: true });
          await mergeAndSync(cred.user.uid);
        } else {
          const cred = await auth.signInWithEmailAndPassword(email, password);
          await mergeAndSync(cred.user.uid);
        }
        closeModal();
      } catch (err) {
        showError(friendlyError(err.code));
        submitBtn.disabled = false;
        submitBtn.textContent = mode === 'signup' ? 'Create account' : 'Log in';
      }
    });

    box.appendChild(closeBtn);
    box.appendChild(title);
    box.appendChild(sub);
    box.appendChild(errorBox);
    box.appendChild(emailInput);
    box.appendChild(passInput);
    if (mode === 'signup') {
      box.appendChild(childInput);
      box.appendChild(disclosureRow);
    }
    box.appendChild(submitBtn);
    box.appendChild(switchRow);
    box.appendChild(forgotRow);

    overlay.appendChild(box);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    return overlay;
  }

  let overlayNode = null;
  function renderModal() {
    if (overlayNode) overlayNode.remove();
    overlayNode = buildModal();
    document.body.appendChild(overlayNode);
  }
  function openModal(initialMode) {
    mode = initialMode || 'signin';
    modalOpen = true;
    renderModal();
  }
  function closeModal() {
    modalOpen = false;
    if (overlayNode) { overlayNode.remove(); overlayNode = null; }
  }

  // ---------- contact form ----------
  // Never shows the real support email anywhere in the UI. Submissions are
  // just saved as documents in their own Firestore collection, timestamped,
  // for Curious C to check later — no separate email-sending setup needed.
  function buildContactModal() {
    const overlay = el('div', { className: 'acct-overlay' });
    const box = el('div', { className: 'acct-box' });

    const closeBtn = el('button', { className: 'acct-close', textContent: '✕' });
    closeBtn.addEventListener('click', () => overlay.remove());

    const title = el('h2', { className: 'acct-title', textContent: 'Questions? Contact us' });
    const sub = el('p', { className: 'acct-sub' }, 'Send us a message and we\u2019ll get back to you.');

    const statusBox = el('div', { className: 'acct-error hidden' });

    const nameInput = el('input', { className: 'acct-input', type: 'text', placeholder: 'Your name' });
    const emailInput = el('input', { className: 'acct-input', type: 'email', placeholder: 'Your email', autocomplete: 'email' });
    const messageInput = el('textarea', { className: 'acct-input acct-textarea', placeholder: 'Your message', rows: 4 });

    const submitBtn = el('button', { className: 'acct-submit', textContent: 'Send message' });

    function showStatus(msg, ok) {
      statusBox.textContent = msg;
      statusBox.className = 'acct-error' + (ok ? ' ok' : '') + (msg ? '' : ' hidden');
    }

    submitBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      const email = emailInput.value.trim();
      const message = messageInput.value.trim();
      if (!name || !email || !message) { showStatus('Please fill in all three fields.'); return; }
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending\u2026';

      // Send to both: Formspree actually delivers it to the inbox (the
      // part that matters most), Firestore keeps a backup copy. Treat it
      // as a success as long as at least the email delivery goes through.
      const emailPromise = fetch(CONTACT_FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      const backupPromise = db.collection('support_requests').add({
        name, email, message,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      const [emailResult, backupResult] = await Promise.allSettled([emailPromise, backupPromise]);
      const emailOk = emailResult.status === 'fulfilled' && emailResult.value.ok;
      if (backupResult.status === 'rejected') console.warn('YCTAS contact form: backup save to Firestore failed.', backupResult.reason);
      if (!emailOk) console.warn('YCTAS contact form: Formspree delivery failed.', emailResult);

      if (emailOk) {
        showStatus('Thanks — your message has been sent!', true);
        nameInput.value = ''; emailInput.value = ''; messageInput.value = '';
        submitBtn.textContent = 'Send message';
        setTimeout(() => overlay.remove(), 4000);
      } else {
        showStatus('Something went wrong sending that — please try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send message';
      }
    });

    box.appendChild(closeBtn);
    box.appendChild(title);
    box.appendChild(sub);
    box.appendChild(statusBox);
    box.appendChild(nameInput);
    box.appendChild(emailInput);
    box.appendChild(messageInput);
    box.appendChild(submitBtn);

    overlay.appendChild(box);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    return overlay;
  }

  function openContactModal() {
    document.body.appendChild(buildContactModal());
  }

  function mountContactLink() {
    const link = document.getElementById('contactLink');
    if (link) {
      link.addEventListener('click', (e) => { e.preventDefault(); openContactModal(); });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountContactLink);
  } else {
    mountContactLink();
  }

  // ---------- account button in the top nav ----------
  const acctBtn = el('button', { className: 'acctbtn' });
  function renderAcctBtn() {
    if (currentUser) {
      acctBtn.textContent = '👤 ' + (currentUser.email.split('@')[0]);
      acctBtn.title = 'Signed in as ' + currentUser.email + ' — tap to log out';
    } else {
      acctBtn.textContent = '👤 Log in';
      acctBtn.title = 'Optional — sync your progress across devices';
    }
  }
  acctBtn.addEventListener('click', () => {
    if (currentUser) {
      if (confirm('Log out of ' + currentUser.email + '? Your progress on this device stays right where it is.')) {
        auth.signOut();
      }
    } else {
      openModal('signin');
    }
  });

  function mountAcctBtn() {
    const nav = document.querySelector('.topnav-right') || document.querySelector('.topnav');
    if (nav) nav.appendChild(acctBtn);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAcctBtn);
  } else {
    mountAcctBtn();
  }

  auth.onAuthStateChanged(user => {
    currentUser = user;
    renderAcctBtn();
  });

})();
