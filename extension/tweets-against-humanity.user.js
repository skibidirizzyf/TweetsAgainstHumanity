// ==UserScript==
// @name        Tweets Against Humanity
// @description Turn Twitter into a deck-building rougelike
// @homepage    https://github.com/rebane2001/TweetsAgainstHumanity/
// @author      rebane2001
// @namespace   rebane2001
// @version     1.0
// @noframes
// @match       https://x.com/*
// @match       https://twitter.com/*
// @grant       none
// ==/UserScript==

const TWC_VERSION = "1.0";

const TWC_SETTINGS = {
    version: TWC_VERSION,
    cardCount: 5,
    autoStart: false,
};

// based on https://stackoverflow.com/a/61511955/2251833
async function waitForQuery(selector) {
    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver(mutations => {
            if (document.querySelector(selector)) {
                observer.disconnect();
                resolve(document.querySelector(selector));
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}

const twcCss = `
.twc-txt-btn {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: none;
    border: none;
    color: light-dark(#536471, #8B98A5);
    transition: color 0.2s;
    &[open], &:hover {
        color: light-dark(#000, #FFF);
    }
    & > summary {
        list-style: none;
    }
}

.twc-start {
    width: 64px;
    height: 64px;
    border: none;
    position: fixed;
    bottom: 0;
    left: 16px;
    cursor: pointer;
    transition: translate 0.2s;
    translate: 0 4px;
    background: linear-gradient(45deg, #1d9bf0, #000);
    color: #FFF;
    &:hover {
        translate: 0 0;
        filter: brightness(1.1);
    }
}

html:has(body[data-twc-started]) {
    scrollbar-width: none;
}

body:not([data-twc-started]) {
    .twc-txt-btn {
        display: none;
    }
}

body[data-twc-started] {

    main div:not([aria-label="Timeline: Conversation"]) > div > [data-testid='cellInnerDiv']:not(:has([data-twc-used])):not(:has(>div>div>div[role=progressbar])) {
        opacity: 0;
        pointer-events: none;
    }
    
    [data-testid='cellInnerDiv']:has([data-twc-used]) {
        position: fixed !important;
        top: 0;
        left: 0;
        transform: none!important;
        transition: display 1s allow-discrete;
        &:has([data-twc-gone]) {
            display: none;
        }
        &>*{border-bottom-color:#0000}
    }
    
    
    [data-twc-card] {
        --max-offset: min(min(512px, 512px / 4.5 * var(--card-count)), calc(50vw - 256px));
        --rot: calc((var(--card-offset) - 0.5) * 2 * min(5deg, 5deg / 4 * var(--card-count)));
        --yRot: calc(max(50px * abs(sin(var(--rot) * 10)), 18px) / 1.5);
        position: absolute;
        background: light-dark(#FFF, #234);
        top: 100dvh;
        left: 50dvw;
        width: 360px;
        width: 480px;
        width: 400px;
        translate: calc(-50% + (var(--card-offset) - 0.5) * 2 * var(--max-offset)) calc(-100px + var(--yRot));
        rotate: var(--rot);
        border: 2px solid light-dark(#EEE8, #123);
        border-radius: 32px;
        @supports (corner-shape: superellipse(1.5)) {
            border-radius: 42px;
            corner-shape: superellipse(1.5);
        }
        box-shadow: 2px 2px 8px light-dark(#8884, #0004);
        padding-right: 12px;
        padding-left: 12px;
    
        transition: translate 0.4s, rotate 0.4s, background 0.4s;
        &:hover, &:has(:hover) {
            background: light-dark(#EEE, #345);
            translate: calc(-50% + (var(--card-offset) - 0.5) * 2 * var(--max-offset)) max(calc(-100% - 32px), -256px);
            --rot: calc((var(--card-offset) - 0.5) * 2 * 2deg);
        }
    
        &[data-twc-pick] {
            --rot: 0deg;
            translate: -50% calc(-50dvh - 50% - 40px + 25px);
        }
    
        &[data-twc-gone] {
            translate: calc(-50% + (var(--card-offset) - 0.5) * 2 * var(--max-offset)) 8px;
        }
    
        [data-testid="tweetText"], [data-testid="tweetPhoto"] {
            transition: filter 0.4s;
            filter: none;
        }
    
        [role="link"]:has([data-testid="Tweet-User-Avatar"]) {
            box-shadow: 4px 4px 16px inset light-dark(#0124, #0128);
            outline: none;
        }
    
        
        &:not([data-twc-pick]) {
            [data-testid="tweetText"], [data-testid="tweetPhoto"] {
                transition: none;
                filter: blur(12px);
            }
        }
    }
    
    [data-testid=primaryColumn] {
        border: none;
    }
    
    [aria-label="Home timeline"]>*:not(:has([data-testid=tweet])):not(:first-child), header[role=banner], [data-testid=sidebarColumn], [data-testid=DMDrawer], [data-testid=GrokDrawer] {
        opacity: 0;
        pointer-events: none;
    }
    
    [aria-label="Home timeline"]:not(:has(div[aria-label="Timeline: Conversation"])) > :first-child {
        pointer-events: all;
        opacity: 1;
        position: fixed;
        top: 0;
        left: 50vw;
        width: 50vw;
        translate: -50% 0;
        nav {
            border-bottom-color: #0000;
        }
        [aria-selected="true"]>*>*>:not(:first-child) {
            opacity: 0;
        }
    }

    [data-testid="cellInnerDiv"]:has(>div>div>div[role=progressbar]) {
        transform: none!important;
        position: fixed!important;
        bottom: 0;
        left: 0;
    }

    .twc-start {
        display: none;
    }

}

`;

const TWC_NEXT_TWEET_SELECTOR = "div:not([aria-label='Timeline: Conversation']) > div > [data-testid='cellInnerDiv']:not(:has(>.HiddenTweet)) [data-testid='tweet']:not([data-twc-used])";
const TWC_SIDEBAR_SELECTOR = "nav[aria-label='Primary']";

function getNextTweets(count) {
    const nextTweets = [...document.querySelectorAll(TWC_NEXT_TWEET_SELECTOR)].slice(0, count);
    nextTweets.forEach(e => e.dataset.twcUsed = true);
    return nextTweets;
}

function setStyle(styleText) {
    let styleEl = document.querySelector(".twc-style");
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.classList.add("twc-style");
        document.head.appendChild(styleEl);
    }
    styleEl.textContent = styleText;
}

function cardNextTweets(count) {
    const nextTweets = getNextTweets(count);
    nextTweets.forEach((e,i) => {
        e.dataset.twcCard = true;
        e.setAttribute("style", (e.getAttribute("style") ?? "") + `; --card-offset: ${i/(count-1)}; --card-count: ${count}`);
        e.addEventListener("click", (ev)=>{ev.preventDefault();pickCard(e)}, {capture:true,once:true});
    });
}

function pickCard(cardEl) {
    if (window.cardSnd) {
        cardSnd.currentTime = 0;
        cardSnd.play();
    }
    const otherCards = [...document.querySelectorAll("[data-twc-card]:not([data-twc-gone])")].filter(e=>e!==cardEl);
    otherCards.forEach(e=>e.dataset.twcGone = true);
    cardEl.dataset.twcPick = true;
    cardNextTweets(TWC_SETTINGS.cardCount);
}

let TWC_GAME_INTERVAL = -1;

async function startGame() {
    document.body.dataset.twcStarted = true;
    await waitForQuery(TWC_NEXT_TWEET_SELECTOR);
    cardNextTweets(TWC_SETTINGS.cardCount);
    // todo: make this better
    if (TWC_GAME_INTERVAL != -1)
        clearInterval(TWC_GAME_INTERVAL);
    TWC_GAME_INTERVAL = setInterval(() => {
        if (!document.querySelector("[data-twc-card]:not([data-twc-gone]):not([data-twc-pick])"))
            cardNextTweets(TWC_SETTINGS.cardCount);
    }, 1000);
}

async function stopGame() {
    if (TWC_GAME_INTERVAL != -1)
        clearInterval(TWC_GAME_INTERVAL);
    delete document.body.dataset.twcStarted;
}

function loadTwcSettings() {
    const loadedSettings = JSON.parse(localStorage.getItem("twc-settings") || "{}");
    Object.entries(TWC_SETTINGS).forEach(([k,v]) => {
        if (Object.hasOwn(loadedSettings, k))
            TWC_SETTINGS[k] = loadedSettings[k];
    });
}

function saveTwcSettings() {
    TWC_SETTINGS.version = TWC_VERSION;
    localStorage.setItem("twc-settings", JSON.stringify(TWC_SETTINGS));
}

function setupTwc() {
    loadTwcSettings();
    addTwcControls();
    setStyle(twcCss);
    if (TWC_SETTINGS.autoStart)
        startGame();
}

function createSetting(name, label, type) {
    const div = document.createElement("div");
    div.classList.add("twc-setting");

    const labelEl = document.createElement("label");
    labelEl.innerText = `${label}: `;

    const input = document.createElement("input");
    input.name = name;
    input.type = type;

    if (type == "checkbox") {
        input.checked = TWC_SETTINGS[name];
    } else {
        input.value = TWC_SETTINGS[name];
    }

    input.oninput = () => {
        if (type == "checkbox") {
            TWC_SETTINGS[name] = input.checked;
        } else {
            TWC_SETTINGS[name] = parseInt(input.value);
        }
        saveTwcSettings();
    }
    
    labelEl.appendChild(input);
    div.appendChild(labelEl);

    return [div, input];
}

function addTwcControls() {
    const twcButton = document.createElement("button");
    twcButton.classList.add("twc-start");
    if (chrome?.runtime?.getURL) {
        twcButton.style.background = `0 / cover url(${chrome.runtime.getURL("/images/icon-128.png")})`;
    } else {
        twcButton.innerText = "Tweets Against Humanity";
    }
    twcButton.onclick = startGame;
    document.body.appendChild(twcButton);

    const twcStop = document.createElement("button");
    twcStop.classList.add("twc-txt-btn");
    twcStop.innerText = "X";
    twcStop.style.position = "fixed";
    twcStop.style.top = "16px";
    twcStop.style.right = "16px";
    twcStop.style.cursor = "pointer";
    twcStop.onclick = stopGame;
    document.body.appendChild(twcStop);

    const twcSettings = document.createElement("details");
    const twcSettingsSum = document.createElement("summary");
    twcSettingsSum.innerText = "Settings";
    twcSettingsSum.style.cursor = "pointer";
    twcSettings.appendChild(twcSettingsSum);
    twcSettings.classList.add("twc-txt-btn");
    twcSettings.style.position = "fixed";
    twcSettings.style.top = "16px";
    twcSettings.style.left = "16px";

    const [cardCountDiv, cardCountInput] = createSetting("cardCount", "Card count", "number");
    cardCountInput.min = 3;
    cardCountInput.max = 7;
    twcSettings.appendChild(cardCountDiv);

    const [autoStartDiv, autoStartInput] = createSetting("autoStart", "Autostart", "checkbox");
    twcSettings.appendChild(autoStartDiv);

    const creditP = document.createElement("p");
    creditP.innerHTML = `
<a href="https://github.com/rebane2001/TweetsAgainstHumanity" target="_blank">Tweets Against Humanity</a> v${TWC_VERSION}<br>
by <a href="https://lyra.horse" target="_blank">rebane2001</a>`;
    twcSettings.appendChild(creditP);

    document.body.appendChild(twcSettings);
}

setupTwc();
