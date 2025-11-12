twitterCardCount = 5;

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
html {
    scrollbar-width: none;
}

[data-testid='cellInnerDiv']:not(:has([data-twc-used])) {
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
    position: absolute;
    background: #234;
    top: 100dvh;
    left: 50dvw;
    width: 360px;
    width: 480px;
    width: 400px;
    translate: calc(-50% + (var(--card-offset) - 0.5) * 2 * 512px) -80px;
    rotate: calc((var(--card-offset) - 0.5) * 2 * 5deg);
    border: 2px solid #123;
    border-radius: 42px;
    corner-shape: superellipse(1.5);
    box-shadow: 2px 2px 8px #0004;
    padding-right: 12px;
    padding-left: 12px;

    transition: translate 0.4s, rotate 0.4s, background 0.4s;
    &:hover, &:has(:hover) {
        background: #345;
        translate: calc(-50% + (var(--card-offset) - 0.5) * 2 * 512px) max(calc(-100% - 32px), -256px);
        rotate: calc((var(--card-offset) - 0.5) * 2 * 2deg);
    }

    &[data-twc-pick] {
        rotate: 0deg;
        /*width: 480px;*/
        translate: -50% calc(-50dvh - 50% - 40px);
    }

    &[data-twc-gone] {
        translate: calc(-50% + (var(--card-offset) - 0.5) * 2 * 512px) 8px;
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
        /*
        [role="link"]:has([data-testid="Tweet-User-Avatar"]), [data-testid="tweetPhoto"] {
            max-width: 280px;
            overflow: clip;
        }
        */
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

/*
[data-twc-card] > * {
    width: 452px;
    flex-grow: 0;
    flex-shrink: 0;
}
*/
`;

const TWC_NEXT_TWEET_SELECTOR = "[data-testid='cellInnerDiv']:not(:has(>.HiddenTweet)) [data-testid='tweet']:not([data-twc-used])";

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
    cardNextTweets(twitterCardCount);
}

function startGame() {
    setStyle(twcCss);
    cardNextTweets(twitterCardCount);
}

waitForQuery(TWC_NEXT_TWEET_SELECTOR).then(startGame);
