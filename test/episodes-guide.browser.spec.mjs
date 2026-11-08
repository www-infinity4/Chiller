import {test,expect} from '@playwright/test';

test.use({viewport:{width:360,height:800}});
const base='http://127.0.0.1:8788/';

test('Chiller 190-story research guide filters both 1985 series without adding unauthorised playback',async({page})=>{
 // Isolate same-origin Chiller for an offline, deterministic Android-width run.
 await page.route(/^https:\/\//,route=>route.abort());
 await page.goto(base,{waitUntil:'domcontentloaded'});
 const guide=page.locator('#episodeGuide');
 await expect(guide).toBeVisible();
 await expect(guide.locator('.episode-research-card')).toHaveCount(20);
 await expect(guide.locator('#episodeGuideStatus')).toContainText('Showing 20 of 190 verified episode records');
 await expect(guide).toContainText('not licensed videos');
 await expect(guide.locator('video, iframe')).toHaveCount(0);

 await page.selectOption('#episodeSeries','twilight-zone-1985');
 await expect(guide.locator('#episodeGuideStatus')).toContainText('20 of 110');
 await page.fill('#episodeSearch','Shatterday');
 await expect(guide.locator('.episode-research-card')).toHaveCount(1);
 await expect(guide.locator('.episode-research-title')).toHaveText('Shatterday');
 const original=guide.getByRole('link',{name:'View original TVmaze episode record'});
 await expect(original).toHaveAttribute('href',/^https:\/\/www\.tvmaze\.com\/episodes\/220627\//);
 await page.fill('#episodeSearch','');
 await page.selectOption('#episodeSeries','alfred-hitchcock-presents-1985');
 await expect(guide.locator('#episodeGuideStatus')).toContainText('20 of 80');
 await expect(guide.locator('.episode-research-card')).toHaveCount(20);
 await page.selectOption('#episodeSeries','all');
 await page.getByRole('button',{name:'Show 20 more stories'}).click();
 await expect(guide.locator('.episode-research-card')).toHaveCount(40);
 await expect(guide.locator('#episodeGuideStatus')).toContainText('40 of 190');
 expect(await guide.evaluate(el=>el.getBoundingClientRect().right<=window.innerWidth+1)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 await expect(guide.locator('.episode-research-policy').first()).toHaveText('Research record · Not a licensed video');
});

test('a failed or altered episode catalog never renders as play-ready Chiller content',async({page})=>{
 await page.route(/^https:\/\//,route=>route.abort());
 await page.route('**/episodes.json',async route=>{
  const response=await route.fetch();
  const payload=await response.json();
  payload.shows[0].stories[0].videoId='unapproved-recording';
  await route.fulfill({json:payload});
 });
 await page.goto(base,{waitUntil:'domcontentloaded'});
 const guide=page.locator('#episodeGuide');
 await expect(guide.locator('#episodeGuideStatus')).toContainText('unavailable or not verified');
 await expect(guide.locator('.episode-research-card')).toHaveCount(0);
 await expect(page.locator('#player iframe')).toHaveCount(0);
});
