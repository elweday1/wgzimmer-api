import cheerio from 'cheerio'

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const uuid = url.searchParams.get("uuid");

    if (!uuid) {
      return new Response("Missing uuid", { status: 400 });
    }

    const listingUrl = `https://www.wgzimmer.ch/wglink/en/${uuid}`;
    const res = await fetch(listingUrl);
    const html = await res.text();
    const $ = cheerio.load(html);

    const match = (regex, s) => {
      const m = s.match(regex);
      return m ? m[0] : "";
    };

    const parseDatesAndRentSection = (val) => {
      const dateRegex = /\d+\.\d+\.\d+/;
      const rentRegex = /\d+/;
      const [starting, ending, rent] = val;

      return {
        Start: match(dateRegex, starting),
        End: match(dateRegex, ending),
        Rent: match(rentRegex, rent),
      };
    };

    const parseAddressSection = (val) => {
      const titles = ["State", "Address", "City", "Neighbourhood", "Nearby"];
      const obj = {};
      titles.forEach((t, i) => (obj[t] = val[i] || ""));
      return obj;
    };

    const data = {};
    $(".wrap").each((_, el) => {
      const section = $(el);
      const title = section.find("h3").text().trim();
      const value = section.find("p").map((_, p) => $(p).text().trim()).get().filter(Boolean);

      if (title === "Dates and rent") {
        Object.assign(data, parseDatesAndRentSection(value));
      } else if (title === "Address") {
        Object.assign(data, parseAddressSection(value));
      } else {
        data[title] = value.join(",");
      }
    });

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  },
};
