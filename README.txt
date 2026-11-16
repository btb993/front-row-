FRONT ROW: your watchlist for movies and TV shows, on phone and PC
=====================================================================

What's in this folder
  index.html             the app
  manifest.webmanifest   makes it installable on phones and computers
  sw.js                  lets it open offline and remembers posters
  *.png                  the app icons

1) PUT THE APP ONLINE with GitHub Pages (one time)
  Open Settings > Pages on this repository.
  Source: Deploy from a branch, Branch: main, folder: / (root). Save.
  After a minute the app lives at:
      https://btb993.github.io/front-row-/
  It sits next to your Book Nook and Save Point, so all three share
  one login on each device.

2) TURN ON SYNC (one time, about 2 minutes)
  Front Row uses the same free Supabase project as your Book Nook.
  a. Open the app and click "Sync". If you're signed in to the Book
     Nook or Save Point in that browser, you're already signed in.
     Otherwise sign in with the same email and password.
  b. The first time, it asks you to add a table for your watchlist:
     press "Copy the database setup", open the Supabase SQL editor
     with the button, paste, press Run, then "Check again".
     This only adds a new table. Your books and games are not touched.

3) PUT IT ON YOUR PHONE
  Open https://btb993.github.io/front-row-/ on the phone, sign in, then:
    iPhone:  Safari > Share > Add to Home Screen
    Android: Chrome > ⋮ menu > Install app
  On a computer, Chrome and Edge show an "Install" button in the top bar.

4) BRING YOUR LIST ACROSS FROM THE CLAUDE VERSION
  In the Front Row inside Claude, press "Back up" and copy the text.
  Here, press "Restore a backup", paste it and press Restore.
  Posters and details are then looked up for every title.

WHAT'S INSIDE (v1.9)
  - Fixed: posters on search, Discover and recommendation cards were
    invisible since v1.7.
  - Home page: Continue watching (compact, scrolls sideways), What's
    playing tonight, Movies to watch, Shows to start, Coming soon on
    your list, Recommended for you, Trending and quick stats.
  - The marquee is smaller and slims down on every page except Home;
    real bulbs chase around the frame with a warm flicker, and the neon
    flickers now and then.
  - Movies and TV shows kept apart: big Movies / TV shows tabs on the
    watchlist and Seen it (remembered), and a Movies / TV switch next to
    the search.
  - Episode checklist for every show (from TVmaze): season tabs, tick
    episodes, "up to here", mark or unmark a whole season; season and
    episode progress follow along.
  - Recommendations: lookups run four at a time and are saved for a
    week, results appear while they load, sequels and spin-offs of what
    you loved come first, and weak picks (IMDb under 6) are left out.

WHAT'S INSIDE (v1.8)
  - IMDb helper (recommended, one time, about 2 minutes): a tiny function
    on your Supabase (supabase/imdb/index.ts) that asks IMDb for the app,
    so posters, brand-new releases and IMDb links load fast and reliably.
    Settings > IMDb helper walks you through it, like Save Point's
    playtime function: Edge Functions > Deploy a new function > Via
    Editor > name it imdb > paste > Deploy > switch off Verify JWT.
  - Faster: search shows results as soon as the first source answers,
    the app connects to the poster servers early, trending loads in
    parallel, and IMDb lookups are remembered.

WHAT'S INSIDE (v1.7)
  - Posters from IMDb work again: IMDb blocks apps from asking it
    directly, so lookups go through the free allorigins.win relay.
    Titles without a poster are looked up again once.
  - Every search, Discover and recommendation card has "+ Watchlist"
    and "✓ Seen" side by side; the list menu and "Not for me" sit on
    the poster. Adding as seen stays put, no pop-up.
  - Sideways rows keep their place when you add something.
  - Recommendations' Refresh works in Discover too, and each refresh
    mixes in new picks.

WHAT'S INSIDE (v1.6)
  - Marking something as seen no longer stamps today's date. The date is
    optional: pick an exact date, just a year, or tap "Today" in the
    title's window. Titles that got today's date automatically were
    cleared once. Undated titles sit under "Date not set" in Seen it.

WHAT'S INSIDE (v1.5)
  - "✓ Seen it" under every poster on list pages and in the watchlist;
    once seen, the button becomes stars so you can rate it right there.
    ▶ starts watching.

WHAT'S INSIDE (v1.4)
  - Discover tab: Recommended for you, Trending this week (from
    Wikipedia page views), Coming soon (upcoming films and series, plus
    release dates and new seasons of what's on your watchlist), and
    Browse by genre and decade, ranked by popularity or IMDb rating.
  - Jog my memory: tick everything you've already seen straight from
    the Browse lists and rate it.
  - Trending this week also shows under your watchlist on the home
    screen.
  - Search finds whole series: "harry potter" brings every film in the
    series, and "Show more results" digs deeper.

WHAT'S INSIDE (v1.3)
  - IMDb ratings and vote counts for every title, from IMDb's daily
    ratings file, refreshed every few days (Settings > IMDb ratings).
    An optional free OMDb key works as a backup.
  - Filter by minimum IMDb rating and sort by it in search, the
    watchlist, Seen it, list pages and What's playing tonight.

WHAT'S INSIDE (v1.2)
  - Choose a poster: every title's window has "Change poster", which
    gathers alternatives from IMDb, TVmaze, Wikipedia in many languages,
    Wikidata and Wikimedia Commons. When a poster is missing or doesn't
    load, the button turns red: "find another". Paste an image link or
    upload your own too.

WHAT'S INSIDE (v1.1)
  - Search also uses IMDb, so brand-new titles show up, and you can
    paste an IMDb link (or a tt number) straight into the search.
    Results can be filtered to Movies or Series.
  - TVmaze fills in exact episodes per season, the network or streamer
    and when the next season starts.
  - Lists have their own look: Velvet premiere, Pride parade, Film noir,
    Midnight horror, Date night, Neon '80s, Comfort blanket, Deep space,
    Video store, Arthouse and Saturday morning. The look is picked from
    the list's name (you can change it), plus an emoji and description.
  - Every list has its own page: add titles from your library or the
    search in one picker, remove with ×, pick one for tonight.
  - Quick menu (the list icon on every poster and search result): set
    the status, must see, tick lists or create a new list on the spot.
  - Seen it: your collection of everything watched, grouped by year,
    with filters, half-star ratings right on the posters, favourites ♥,
    a "How was it?" row for unrated titles and "Add something you've
    already seen" mode.
  - Recommended for you: built from the directors, creators and actors
    of what you rated highest, with "Not for me" to hide picks.
  - More stats: how you rate, decades, genres you rate highest, actors
    you keep seeing.

WHAT'S INSIDE (v1.0)
  - Search by title, director or actor. Posters, cast, runtime, seasons,
    episodes and IMDb, Rotten Tomatoes and Metacritic scores come from
    Wikipedia and Wikidata (free, no key).
  - Searching for a person shows their films and series.
  - Each title opens a lobby card: plot, links to IMDb, Wikipedia, the
    trailer and where to stream, and "More from" the director or creator.
  - Watchlist with Want to watch, Watching, Watched and Dropped, filters,
    sorting and a must-see ribbon.
  - The screening room: series you're watching, with +1 episode, next
    season and an episode strip for the season.
  - Your own lists (Date night, Spooky season, ...), each with a poster
    fan and "pick one tonight".
  - What's playing tonight: pick by mood, time and movie or series.
  - Stats: ticket stubs for everything you finished this year, monthly
    chart, genres, your top ten, hours watched and hours left.
  - Velvet (dark) and Matinee (light) themes, offline use, install as an
    app, sync between devices, backup and restore.

GOOD TO KNOW
  - Brand-new releases can take a few days to show up on Wikidata. Add
    them by hand meanwhile; "Look up poster and details again" in the
    title's window fills them in later.
  - Any title can get your own poster: drop, paste or pick an image, or
    paste an image link, under "Edit details and poster".
  - To update the app later, replace index.html in this repository.
