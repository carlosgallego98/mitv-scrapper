import { addDays, format } from 'date-fns'
import pupetteer from 'puppeteer'
import randomUA from 'random-useragent'

var photoUrls: string[] = [];


const init = async () => {
    const main = "https://www.facebook.com/photo.php?fbid=1360150441073694&set=pb.100012362531992.-2207520000..&type=3"

    const browser = await pupetteer.launch({
        userDataDir: 'tmp/data',
        headless: true,
    })

    console.log("Facebook album photo scrapper...")
    const page = await browser.pages().then(e => e[0]);;
    await page.setViewport({ height: 1080, width: 1920 })
    await page.goto(main)

    const getLink = async (url = false) => {
        await page.waitForSelector('div[aria-label="Actions for this post"]');
        await page.click('div[aria-label="Actions for this post"]');
        await page.waitForSelector('a[download]');

        await page.click('a[download]');

        const photoViewer = await page.waitForSelector('div[data-pagelet="MediaViewerPhoto"]')
        await photoViewer.focus();
        const nextPhoto = await page.waitForSelector('div[aria-label="Next photo"]');

        if (nextPhoto) {
            page.keyboard.press("ArrowRight");
            setTimeout(() => {
                console.log("Pasando Photo");
                getLink();
            }, 2000);
        }

    }
    getLink()

}

init()
