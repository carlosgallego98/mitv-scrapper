import { addDays, format } from 'date-fns'
import ExcelJS from "exceljs";
import pupetteer from 'puppeteer'
import randomUA from 'random-useragent'
import { Channel, Broadcast } from './types'

const today = new Date();
var day = 0
var channels: any[] = [];

const slugify = (str: String) => {
    return str.toString()
        .toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '');
}
const timeToDate = (time, days) => {
    const rx = /[am|pm]\w+/g
    const timeSplit = time.replace(rx, '').split(":")

    let hour = 0;
    if (rx.exec(time)[0] == "am") {
        hour = timeSplit[0]
    } else {
        hour = timeSplit[0] * 1 + 12;
    }

    const date = addDays(today, days);
    date.setUTCHours(hour, timeSplit[1], 0);
    return date
}

const init = async () => {
    const main = "https://mi.tv"

    const minimal_args = [
        '--autoplay-policy=user-gesture-required',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-client-side-phishing-detection',
        '--disable-component-update',
        '--disable-default-apps',
        '--disable-dev-shm-usage',
        '--disable-domain-reliability',
        '--disable-extensions',
        '--disable-features=AudioServiceOutOfProcess',
        '--disable-hang-monitor',
        '--disable-ipc-flooding-protection',
        '--disable-notifications',
        '--disable-offer-store-unmasked-wallet-cards',
        '--disable-popup-blocking',
        '--disable-print-preview',
        '--disable-prompt-on-repost',
        '--disable-renderer-backgrounding',
        '--disable-setuid-sandbox',
        '--disable-speech-api',
        '--disable-sync',
        '--hide-scrollbars',
        '--ignore-gpu-blacklist',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-default-browser-check',
        '--no-first-run',
        '--no-pings',
        '--no-sandbox',
        '--no-zygote',
        "--incognito",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-setuid-sandbox",
        "--no-sandbox",
        '--password-store=basic',
        '--use-gl=swiftshader',
        '--use-mock-keychain',
    ]

    const blocked_domains = [
        'googlesyndication.com',
        'adservice.google.com',
        'cm.g.doubleclick.net',
        "pagead2.googlesyndication.com",
        'googleads4.g.doubleclick.net',
        'ib.adnxs.com',
        'v.lkqd.net',
        'www.gstatic.com',
        'fundingchoicesmessages.google.com',
        'securepubads.g.doubleclick.net'
    ]

    const browser = await pupetteer.launch({
        userDataDir: '/tmp/data',
        headless: false,
        args: minimal_args
    })

    const page = await browser.pages().then(e => e[0]);;

    await page.setRequestInterception(true);

    page.on('request', request => {
        const url = request.url()
        if (blocked_domains.some(domain => url.includes(domain))) {
            request.abort();
        } else {
            request.continue();
        }
    });

    console.log("MiTV scrapper...")
    const navigate = async (url = false) => {
        const userAgent = randomUA.getRandom()
        await page.setUserAgent(userAgent)
        await page.setViewport({ height: 1080, width: 1920 })
        await page.goto(url ? `${main}${url}` : main, { timeout: 0 })
        await page.waitForSelector("#channels")

        const channelsDom = await page.$$(".channel")

        for (const channel of channelsDom) {

            const inner = await channel.$(".channel-inner")

            if (inner) {
                const channelTitle = await inner.$(".c>h3")
                const channelImg = await inner.$(".c>.logo")

                const getTitle = await page.evaluate(
                    channelTitle => channelTitle.innerText,
                    channelTitle
                );
                const getImg = await page.evaluate(
                    channelImg => channelImg.getAttribute("src"),
                    channelImg
                );

                const broadcasts = await inner.$$(".broadcasts>li")

                const indexedChannels = await channels
                    .reduce((acc, channel: Channel) =>
                        ({ ...acc, [slugify(channel.title)]: channel, }), {});

                const channelIndex = await slugify(getTitle)
                const channel: Channel = await indexedChannels[channelIndex];

                const broadcastsData: Broadcast[] = []
                for (const broadcast of broadcasts) {
                    const broadcastTitle = await broadcast.$(".title")
                    const broadcastTime = await broadcast.$(".time")

                    const getBroadcastTitle = await page.evaluate(
                        broadcastTitle => broadcastTitle.innerText,
                        broadcastTitle
                    )

                    const getBroadcastTime = await page.evaluate(
                        broadcastTime => broadcastTime.innerText,
                        broadcastTime
                    )

                    const broadcastData = {
                        title: getBroadcastTitle,
                        date: timeToDate(getBroadcastTime, day),
                        time: getBroadcastTime
                    };

                    if (channel) {
                        indexedChannels[channelIndex].broadcasts.push(broadcastData)
                    } else {
                        broadcastsData.push(broadcastData)
                    }
                }


                if (!channel) {
                    channels.push({
                        title: getTitle,
                        img: getImg,
                        broadcasts: broadcastsData
                    });
                }
            }

            const nextDay = await page.$(".date-selection-bar>.option.selected + .option>a")

            if (nextDay) {

                const getNextDayUrl = await page.evaluate(
                    nextDay => nextDay.getAttribute("href"),
                    nextDay
                )
                const getNextDayTitle = await page.evaluate(
                    nextDay => nextDay.innerText,
                    nextDay
                )

                day++
                console.log(`Navegando al dia ${getNextDayTitle} ${format(addDays(today, day), "d")}`);
                await navigate(getNextDayUrl)
            } else {
                await browser.close()

                const workbook = new ExcelJS.Workbook();
                const fileName = `programacion-mitv-fecha-hoy.xlsx`;

                channels.forEach((channel: Channel) => {
                    const sheet = workbook.addWorksheet(channel.title);
                    const reColumns = [
                        { header: "Nombre", key: "title" },
                        { header: "Fecha", key: "date" },
                        { header: "Hora", key: "time" },
                        { header: "Extra", key: "information" },
                    ]

                    sheet.columns = reColumns;

                    sheet.addRows(channel.broadcasts);
                })

                console.log("Generando arhivo de excel...");
                workbook.xlsx
                    .writeFile(fileName)
                    .then((e) => {
                        console.log("Archivo creado exitosamente");
                    })
                    .catch(() => {
                        console.log("Algo sucedio guardando el archivo EXCEL");
                    });
            }
        }
    }
    navigate()
}

init()
