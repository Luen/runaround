const express = require('express');

const app = express();
const port = process.env.PORT || 4008;

app.get('/', (req, res) => {
  res.send(`<html><head></head><body>
    <h1>About Runaround</h1>
    <p>Runaround is a Townsville-based running website that aims to promote running in our community, inspire others to get outdoors, and stay connected with like-minded people.
The Townsville Virtual Running Series is the brainchild of Sidney Willis from <a href="https://www.hungryrunner.net/">Hungry Runner Coaching</a>. These virtual running series allow participants the flexibility that conventional races can't offer.</p>
<div>
<a href="https://www.facebook.com/hungryrunnercoaching/">Facebook</a>
<a href="https://www.instagram.com/hungryrunnercoaching/">Instagram</a>
<a href="http://www.youtube.com/channel/UCmhB-NcSDzajJ9o3Hx9-9nw">YouTube</a>
</div>
<div>
<a href="https://wanderstories.space/">Wanderstories</a>
&
<a href="https://www.hungryrunner.net/">Hungry Runner</a>
</div>

<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-1X8FP56G6T"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-1X8FP56G6T');
</script>

</body></html>`);
});

app.listen(port, () => {
  console.log(`Runaround listening on port ${port}`);
});
