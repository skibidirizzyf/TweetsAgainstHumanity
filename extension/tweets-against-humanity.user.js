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

let TWC_CARD_COUNT = 5;

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

body[data-twc-started] {

    main div:not([aria-label="Timeline: Conversation"]) > div > [data-testid='cellInnerDiv']:not(:has([data-twc-used])) {
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
        --max-offset: min(512px, calc(50vw - 256px));
        --rot: calc((var(--card-offset) - 0.5) * 2 * 5deg);
        --yRot: calc(max(50px * abs(sin(var(--rot) * 10)), 18px) / 1.5);
        position: absolute;
        background: #234;
        top: 100dvh;
        left: 50dvw;
        width: 360px;
        width: 480px;
        width: 400px;
        translate: calc(-50% + (var(--card-offset) - 0.5) * 2 * var(--max-offset)) calc(-100px + var(--yRot));
        rotate: var(--rot);
        border: 2px solid #123;
        border-radius: 42px;
        corner-shape: superellipse(1.5);
        box-shadow: 2px 2px 8px #0004;
        padding-right: 12px;
        padding-left: 12px;
    
        transition: translate 0.4s, rotate 0.4s, background 0.4s;
        &:hover, &:has(:hover) {
            background: #345;
            translate: calc(-50% + (var(--card-offset) - 0.5) * 2 * var(--max-offset)) max(calc(-100% - 32px), -256px);
            --rot: calc((var(--card-offset) - 0.5) * 2 * 2deg);
        }
    
        &[data-twc-pick] {
            --rot: 0deg;
            /*width: 480px;*/
            translate: -50% calc(-50dvh - 50% - 40px);
        }
    
        &[data-twc-gone] {
            translate: calc(-50% + (var(--card-offset) - 0.5) * 2 * var(--max-offset)) 8px;
        }
    
        [data-testid="tweetText"], [data-testid="tweetPhoto"] {
            transition: filter 0.4s;
            filter: none;
        }
    
        [role="link"]:has([data-testid="Tweet-User-Avatar"]) {
            box-shadow: 4px 4px 16px inset #0128;
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
    
    [aria-label="Home timeline"]>*:not(:has([data-testid=tweet])), header[role=banner], [data-testid=sidebarColumn], [data-testid=DMDrawer], [data-testid=GrokDrawer] {
        opacity: 0;
        pointer-events: none;
    }
    
    [aria-label="Home timeline"]>:first-child {
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
        e.setAttribute("style", (e.getAttribute("style") ?? "") + `; --card-offset: ${i/(count-1)}`);
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
    cardNextTweets(TWC_CARD_COUNT);
}

async function startGame() {
    document.body.dataset.twcStarted = true;
    await waitForQuery(TWC_NEXT_TWEET_SELECTOR);
    cardNextTweets(TWC_CARD_COUNT);
    // todo: make this better
    setInterval(() => {
        if (!document.querySelector("[data-twc-card]:not([data-twc-gone]):not([data-twc-pick])"))
            cardNextTweets(TWC_CARD_COUNT);
    }, 1000);
}

function setupTwc() {
    addTwcButton();
    setStyle(twcCss);
}

function addTwcButton() {
    const twcButton = document.createElement("button");
    twcButton.classList.add("twc-start");
    if (chrome?.runtime?.getURL) {
        twcButton.style.background = `0 / cover url(${chrome.runtime.getURL("/images/icon-128.png")})`;
    } else {
        twcButton.innerText = "Tweets Against Humanity";
    }
    twcButton.onclick = () => startGame(1);
    document.body.appendChild(twcButton);
}

setupTwc();
//waitForQuery(TWC_SIDEBAR_SELECTOR).then(setupTwc);
//waitForQuery(TWC_NEXT_TWEET_SELECTOR).then(startGame);
