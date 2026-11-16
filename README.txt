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
