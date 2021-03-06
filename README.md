# DMARCation

Analysis of DMARC report emails. [See DMARC.org for more info](https://dmarc.org/overview/)

Enable DMARC reporting on your domain by adding a `TXT` record on `_dmarc` for your domain. eg:

`_dmarc.yourdomain.com TXT "v=DMARC1; p=reject; rua=mailto:your@email.com"`

## Requirements

Node >=11.4

## Running

Supply a mailbox file in [MBOX format](https://en.wikipedia.org/wiki/Mbox) with DMARC report emails in (these emails should each contain a zipped or gzipped xml filewith stats about mail delivery). [Thunderbird](https://www.thunderbird.net) stores its emails in this format. Outlook can export to this format with the `Apple Mac Export` option. Exports from Apple Mail are in this format.

To convert a [Maildir](https://en.wikipedia.org/wiki/Maildir) format mailbox to a format DMARCation can accept, run this command from the Maildir directory

`find -type f -exec echo "From " \; -exec cat {} \; > mbox`

After the mails are processed and the domain names looked up some stats are displayed on the commandline and a graph is hosted at [http://localhost:8000](http://localhost:8000). You can drill down into days by clicking on the bars and hide/show the different stats by clicking on the lengend.

### With Docker

either

`./run.sh mailboxfilename`

or

`docker build -t dmarcation`

`docker run --name dmarcation -p8000:8000 --rm -v fullpathtomailboxfile:/code/mailboxfilename dmarcation mailboxfilename`

### Without Docker

`npm install`
`npm start -- mailboxfilename`

### To limit by date

From the 1st of January

`./run.sh mailboxfilename 2019-01-01`

Between January and March

`./run.sh mailboxfilename 2019-01-01 2019-03-01`
