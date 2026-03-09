document.addEventListener('DOMContentLoaded', () => {

    // --- UI Elements ---
    const entryOverlay = document.getElementById('entry-overlay');
    const enterBtn = document.getElementById('enter-btn');
    const bgAudio = document.getElementById('bg-audio');
    const scrollPrompt = document.getElementById('scroll-prompt');
    const scrollPrompt2 = document.getElementById('scroll-prompt-2');
    const endEventSection = document.getElementById('end-event-section');

    enterBtn.addEventListener('click', () => {
        // Play audio (interaction fulfills browser autoplay policy)
        bgAudio.play().catch(e => console.log("Audio play failed:", e));

        // Hide overlay and allow scrolling
        entryOverlay.classList.add('hidden');
        document.body.classList.remove('no-scroll');

        // Show scroll prompt
        scrollPrompt.classList.remove('hidden');
    });

    // --- Zero-Lag Image Sequence Playback ---
    const progressBar = document.getElementById('progressBar');
    const bgCanvas = document.getElementById('bg-canvas');
    let ctx = null;
    if (bgCanvas) {
        ctx = bgCanvas.getContext('2d', { alpha: false }); // alpha: false optimizes rendering
    }

    // Config: We generated exactly 350 frames in the /frames directory
    const TOTAL_FRAMES = 350;
    const TOTAL_LOADS = TOTAL_FRAMES + 1; // 350 frames + 1 special end script image
    const images = [];

    let specialImage = new Image();
    specialImage.src = "IMG_9639.webp";

    let imagesLoaded = 0;

    // We will extract average color from the center of the frame occasionally
    let lastColorExtractTime = 0;

    function setAvgBackgroundColor(img) {
        if (!ctx) return;
        try {
            // Draw a tiny version of the image to the hidden color canvas
            const colorCanvas = document.getElementById('color-canvas');
            const colorCtx = colorCanvas.getContext('2d', { willReadFrequently: true });
            colorCanvas.width = 64;
            colorCanvas.height = 64;
            colorCtx.drawImage(img, 0, 0, 64, 64);

            const frame = colorCtx.getImageData(0, 0, 64, 64);
            const data = frame.data;
            let r = 0, g = 0, b = 0, count = 0;

            for (let i = 0; i < data.length; i += 16) {
                r += data[i];
                g += data[i + 1];
                b += data[i + 2];
                count++;
            }

            // Set dynamic background glow to match the frame
            document.body.style.backgroundColor = `rgb(${r / count}, ${g / count}, ${b / count})`;
        } catch (e) {
            // Context could fail if tainted, ignore
        }
    }

    // Smart Preloading of all frames into memory
    const loadingScreen = document.createElement('div');
    loadingScreen.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;background:#000;color:#d4af37;display:flex;justify-content:center;align-items:center;z-index:99999;font-family:'Montserrat',sans-serif;";
    loadingScreen.innerText = "Loading High-Quality Experience... 0%";
    if (bgCanvas) document.body.appendChild(loadingScreen);

    // Helper function to mimic object-fit: contain on a canvas
    function drawImageContain(ctx, img, canvasWidth, canvasHeight) {
        // Find the scale to fit the image inside the canvas without cropping
        const scale = Math.min(canvasWidth / img.width, canvasHeight / img.height);

        // Center the image based on the scaled size
        const x = (canvasWidth / 2) - (img.width / 2) * scale;
        const y = (canvasHeight / 2) - (img.height / 2) * scale;

        // Clear previous frame and draw the correctly proportioned image
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
    }

    // Resize listener to keep canvas sharp and responsive
    function resizeBgCanvas() {
        if (!bgCanvas) return;
        const container = bgCanvas.parentElement;
        bgCanvas.width = container.clientWidth;
        bgCanvas.height = container.clientHeight;

        // Fire a scroll event to redraw properly
        if (imagesLoaded === TOTAL_LOADS && ctx) {
            window.dispatchEvent(new Event('scroll'));
        }
    }
    window.addEventListener('resize', resizeBgCanvas);

    function checkAllLoaded() {
        if (loadingScreen) loadingScreen.innerText = `Loading High-Quality Experience... ${Math.floor((imagesLoaded / TOTAL_LOADS) * 100)}%`;
        if (imagesLoaded === TOTAL_LOADS) {
            if (loadingScreen) loadingScreen.remove();
            resizeBgCanvas();
            drawImageContain(ctx, images[0], bgCanvas.width, bgCanvas.height);
            setAvgBackgroundColor(images[0]);
        }
    }

    specialImage.onload = () => {
        imagesLoaded++;
        checkAllLoaded();
    };

    for (let i = 1; i <= TOTAL_FRAMES; i++) {
        const img = new Image();
        const paddedIndex = i.toString().padStart(4, '0');
        img.src = `frames/frame_${paddedIndex}.jpg`;
        img.onload = () => {
            imagesLoaded++;
            checkAllLoaded();
        };
        images.push(img);
    }

    // Performance: Extreme Debounce (Ticking Lock)
    let ticking = false;

    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const winScroll = Math.max(0, document.body.scrollTop || document.documentElement.scrollTop);
                const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
                const scrollPercentage = height > 0 ? winScroll / height : 0;

                // Update progress bar
                progressBar.style.width = (scrollPercentage * 100) + '%';

                // --- ZERO LAG IMAGE DRAWING ---
                if (images.length === TOTAL_FRAMES && imagesLoaded === TOTAL_LOADS && ctx) {
                    // Map the first 80% of scroll to the 350 frames
                    const frameScrollPct = Math.min(scrollPercentage / 0.80, 1.0);
                    const frameIndex = Math.max(0, Math.min(
                        TOTAL_FRAMES - 1,
                        Math.floor(frameScrollPct * TOTAL_FRAMES)
                    ));

                    // Instantly draw the pre-rendered image using proportional contain logic
                    ctx.globalAlpha = 1.0;
                    drawImageContain(ctx, images[frameIndex], bgCanvas.width, bgCanvas.height);

                    // Draw the special image with fade in/out after the frames finish
                    if (scrollPercentage > 0.80) {
                        let specialAlpha = 0;
                        if (scrollPercentage <= 0.84) {
                            specialAlpha = (scrollPercentage - 0.80) / 0.04;
                        } else {
                            specialAlpha = 1.0; // Hold at 100% until the end where the canvas itself fades out
                        }

                        if (specialAlpha > 0) {
                            ctx.globalAlpha = specialAlpha;
                            drawImageContain(ctx, specialImage, bgCanvas.width, bgCanvas.height);
                            ctx.globalAlpha = 1.0; // Reset
                        }
                    }

                    // Update background color (Throttled to run at most ~10 times a second)
                    const now = Date.now();
                    if (now - lastColorExtractTime > 100) {
                        setAvgBackgroundColor(images[frameIndex]);
                        lastColorExtractTime = now;
                    }
                }

                // Fade out primary scroll prompt once user starts scrolling
                if (scrollPercentage > 0.01 || !entryOverlay.classList.contains('hidden')) {
                    scrollPrompt.classList.add('hidden');
                } else {
                    scrollPrompt.classList.remove('hidden');
                }

                // Show secondary scroll prompt during the image reveal, but before the end section
                if (scrollPercentage > 0.84 && scrollPercentage < 0.98) {
                    if (scrollPrompt2) scrollPrompt2.classList.remove('hidden');
                } else {
                    if (scrollPrompt2) scrollPrompt2.classList.add('hidden');
                }

                // Check if user has reached the end of the scroll
                if (scrollPercentage > 0.98) {
                    endEventSection.classList.remove('hidden');
                } else {
                    endEventSection.classList.add('hidden');
                }

                // Fade out the canvas as the end event section takes over fully
                if (scrollPercentage > 0.96) {
                    // Fade out from 0.96 to 0.99
                    const fadeOutPct = (scrollPercentage - 0.96) / 0.03;
                    bgCanvas.style.opacity = Math.max(0, 1 - fadeOutPct);
                } else {
                    bgCanvas.style.opacity = 1;
                }

                // if (scrollPercentage > 0.88) {
                //     if (imageRevealSection) imageRevealSection.classList.remove('hidden');
                // } else {
                //     if (imageRevealSection) imageRevealSection.classList.add('hidden');
                // }

                ticking = false;
            });

            ticking = true;
        }
    }, { passive: true }); // PERFORMANCE: Passive listener prevents scroll blocking

    // --- Booking Logic & Navigation ---
    const bookBtn = document.getElementById('book-photobooth-btn');
    if (bookBtn) {
        bookBtn.addEventListener('click', () => {
            window.location.href = "https://R1PHOTOBOTH.MAITREYAWIRA.COM";
            // Allow them to unlock and scroll back up if they close out of booking
            document.body.classList.remove('no-scroll');
            endEventSection.classList.add('hidden');
        });
    }

    const backBtn = document.getElementById('back-to-top-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            // Smoothly scroll to the very top
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
            // Hide the end screen so they can interact with the entry or scroll down again
            endEventSection.classList.add('hidden');
        });
    }

    // --- Procedural Clouds Generation ---
    function generateClouds() {
        const container = document.getElementById('clouds-container');
        const numClouds = Math.floor(Math.random() * 8) + 5; // 5 to 12 clouds

        for (let i = 0; i < numClouds; i++) {
            let cloud = document.createElement('div');
            cloud.className = 'cloud';

            // Randomize size between 200px and 600px
            const size = Math.floor(Math.random() * 400) + 200;
            cloud.style.width = `${size}px`;
            cloud.style.height = `${size * 0.6}px`; // Slightly flattened horizontally

            // Randomize vertical position (cover almost full height)
            const topPos = Math.floor(Math.random() * 90);
            cloud.style.top = `${topPos}vh`;

            // Randomize animation duration (super slow drift)
            const duration = Math.floor(Math.random() * 60) + 40; // 40s to 100s
            cloud.style.animationDuration = `${duration}s`;

            // Randomize animation delay to prevent clumping
            const delay = -Math.floor(Math.random() * duration);
            cloud.style.animationDelay = `${delay}s`;

            // Append to DOM
            container.appendChild(cloud);
        }
    }

    // Initialize
    generateClouds();

    // --- Ambient Particle System ---
    const pCanvas = document.getElementById('particle-canvas');
    if (pCanvas) {
        const pCtx = pCanvas.getContext('2d');
        let particles = [];

        // Resize canvas to window size
        function resizeParticleCanvas() {
            pCanvas.width = window.innerWidth;
            pCanvas.height = window.innerHeight;
            // Re-initialize particles on resize to fit new screen layout
            initParticles();
        }

        window.addEventListener('resize', resizeParticleCanvas);

        class Particle {
            constructor() {
                this.reset();
            }

            reset() {
                this.x = Math.random() * pCanvas.width;
                this.y = Math.random() * pCanvas.height;

                // Determine particle type: 60% stars, 30% steam, 10% beans
                const typeRand = Math.random();
                if (typeRand < 0.6) {
                    this.type = 'star';
                } else if (typeRand < 0.9) {
                    this.type = 'steam';
                } else {
                    this.type = 'bean';
                }

                if (this.type === 'star') {
                    // Shimmering stars
                    this.vx = (Math.random() - 0.5) * 0.2;
                    this.vy = (Math.random() - 0.5) * 0.2;
                    this.baseSize = Math.random() * 1.5 + 0.5; // Small
                    this.size = this.baseSize;
                    this.alpha = Math.random() * 0.7 + 0.1;
                    this.pulseSpeed = Math.random() * 0.05 + 0.01; // Fast shimmer
                    this.color = '255, 255, 255'; // White/Silver
                } else if (this.type === 'steam') {
                    // Rising coffee steam
                    this.vx = Math.random() * 0.5 - 0.25; // Gentle sway
                    this.vy = -Math.random() * 0.8 - 0.2; // Move upwards
                    this.baseSize = Math.random() * 15 + 10; // Large, diffuse
                    this.size = this.baseSize;
                    this.alpha = Math.random() * 0.15 + 0.05; // Very faint
                    this.pulseSpeed = Math.random() * 0.01 + 0.005; // Slow billow
                    this.color = '220, 200, 180'; // Warm brownish-white
                } else if (this.type === 'bean') {
                    // Falling coffee beans
                    this.vx = (Math.random() - 0.5) * 0.5;
                    this.vy = Math.random() * 1.5 + 0.5; // Move downwards
                    this.baseSize = Math.random() * 4 + 3; // Bean size
                    this.size = this.baseSize;
                    this.alpha = Math.random() * 0.4 + 0.2; // Semi-transparent
                    this.pulseSpeed = 0; // Beans don't pulse
                    this.rotation = Math.random() * Math.PI * 2;
                    this.rotSpeed = (Math.random() - 0.5) * 0.05;
                    this.color = '92, 58, 33'; // Rich coffee brown
                }

                this.pulseTarget = Math.random() * Math.PI * 2;
            }

            update() {
                // Apply specific movement behaviors
                if (this.type === 'steam') {
                    // Add sine wave sway to steam
                    this.x += Math.sin(Date.now() / 1000 + this.pulseTarget) * 0.5;
                } else if (this.type === 'bean') {
                    this.rotation += this.rotSpeed;
                }

                this.x += this.vx;
                this.y += this.vy;

                // Pulse opacity and size (except for beans)
                let currentAlpha = this.alpha;
                if (this.type !== 'bean') {
                    this.pulseTarget += this.pulseSpeed;
                    currentAlpha = this.alpha + Math.sin(this.pulseTarget) * (this.type === 'star' ? 0.4 : 0.05);
                    this.size = this.baseSize + Math.abs(Math.sin(this.pulseTarget)) * (this.type === 'star' ? 2 : 5);
                }

                // Wrap around edges
                if (this.x < -50) this.x = pCanvas.width + 50;
                if (this.x > pCanvas.width + 50) this.x = -50;
                if (this.y < -50) {
                    this.y = pCanvas.height + 50;
                    if (this.type === 'steam') this.x = Math.random() * pCanvas.width; // Reset steam horizontally
                }
                if (this.y > pCanvas.height + 50) {
                    this.y = -50;
                    if (this.type === 'bean') this.x = Math.random() * pCanvas.width; // Reset bean horizontally
                }

                return Math.max(0, Math.min(1, currentAlpha)); // Clamp alpha
            }

            draw() {
                const currentAlpha = this.update();
                pCtx.save();

                if (this.type === 'star' || this.type === 'steam') {
                    pCtx.beginPath();
                    pCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                    pCtx.fillStyle = `rgba(${this.color}, ${currentAlpha})`;

                    // PERFORMANCE OPTIMIZATION: 
                    // shadowBlur is removed. It causes massive lag loops in Chromium/Opera when redrawn 60fps

                    pCtx.fill();
                } else if (this.type === 'bean') {
                    // Draw a simple coffee bean (oval with a curve in the middle)
                    pCtx.translate(this.x, this.y);
                    pCtx.rotate(this.rotation);
                    pCtx.beginPath();
                    // Basic oval shape
                    pCtx.ellipse(0, 0, this.size * 1.2, this.size * 0.8, 0, 0, Math.PI * 2);
                    pCtx.fillStyle = `rgba(${this.color}, ${currentAlpha})`;
                    pCtx.fill();

                    // The bean crack (darker line through center)
                    pCtx.beginPath();
                    pCtx.moveTo(-this.size * 0.8, 0);
                    pCtx.quadraticCurveTo(0, this.size * 0.4, this.size * 0.8, -this.size * 0.1);
                    pCtx.strokeStyle = `rgba(30, 15, 5, ${currentAlpha})`; // Darker brown
                    pCtx.lineWidth = this.size * 0.15;
                    pCtx.stroke();
                }

                pCtx.restore();
            }
        }

        function initParticles() {
            particles = [];
            // Amount of particles scales roughly with screen area
            // PERFORMANCE: Reduced particle count slightly for smoother cross-browser rendering
            const numParticles = Math.floor((pCanvas.width * pCanvas.height) / 15000);
            for (let i = 0; i < numParticles; i++) {
                particles.push(new Particle());
            }
        }

        function animateParticles() {
            pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
            particles.forEach(p => p.draw());
            requestAnimationFrame(animateParticles);
        }

        // Start system
        resizeParticleCanvas();
        animateParticles();
    }
});
