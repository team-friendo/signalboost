import React from 'react'
import Layout from '../components/layout'
import SEO from '../components/seo'

const IndexPage = () => (
  <Layout>
    <SEO title="Signalboost: Sichere Textblasts und Hotlines für Activisti*" />
    <p>
      Signalboost ermöglicht es Activisti* Signal zu benutzen um Massennachrichten zu verschicken und Hotline tips auf ihren Telefonen zu empfangen ohne ihre Identität preiszugeben oder Geld auszugeben. <br />
      Es ist <em style={{ color: '#ff79c6' }}>sicher, einfach und gratis.</em>
    </p>

    <h3>Sicher:</h3>
    <ul>
      <li>
        Signalboost versendet Nachrichten über <a href="https://signal.org">Signal</a>,
        der sicherste verschlüsselte Nachrichtendienst den es für Telefone gibt.
      </li>
      <li>
        Weder Telefonnummern noch Namen werden dabei angezeigt. Es können Nachrichten versandt und empfangen werden ohne die eigene Identität preiszugeben -- ohne die Angst was passiert wenn ein beteiligtes Telefon gestohlen wird.
      </li>
      <li>
        Signalboost erhält das Minimum an Benutzer Metadaten um die Nachrichten zu verteilen. Die maintainer, Team Friendo , werden versuchen sie zu bewegen die Daten herauszugeben widerstehen, und arbeiten an{' '}
        <a href="https://0xacab.org/team-friendo/signalboost/issues/68">
          Updates
        </a>{' '}
        welche ein Herausgeben der Daten unmöglich machen.
      </li>
    </ul>

    <h3>Einfach:</h3>
    <ul>
      <li>
        Signalboost
 ist zum Versenden von Nachrichten in nur 1 Richtung gedacht. Admins können Meldungen an große Grupen versenden und von allen Hotline Tips empfangen. Das ist alles.
      </li>
      <li>
        Teilnehmer*innen können sich untereinander keine Nachrichten schicken. Das eliminiert das typische Hin- und Hergeschreibe in großen Signal oder WhatsApp Gruppen.
      </li>
      <li>
        Es versucht ein Problem zu lösen und das richtig. Das macht es einfacher inmitten des unübersichtlichen Meeres an Techtools zu wissen wofür es da ist.
      </li>
    </ul>

    <h3>Gratis:</h3>
    <ul>
      <li>
        Wir machen diese Software für die kollektive Befreiung aller, nicht für Profit. Wir nehmen kein Geld dafür und werden das auch nie tun.
      </li>
    </ul>

    <h1>Wo Anfangen?</h1>

    <h3>Um einen Signalboost Kanal zu bekommen:</h3>
    <ul>
      <li>
        Schicke eine Signalnachricht an{' '}
        <span style={{ color: '#bd93f9' }}>+1-938-444-8536</span>.
      </li>
      <li>
        Die Nachricht sollte einen Namen für den Kanal und die Signalnummern aller Admins enthalen.
      </li>
      <li>
        Du wirst eine Begrüßungsnachricht erhalten sobald der Kanal erstellt wurde.
      </li>
    </ul>

    <h3>Sobald du einen Kanal hast:</h3>
    <ul>
      <li>
        Mit dem Kanal ist eine Signal Telefonnummer assoziert. Jedesmal wenn diese eine Nachricht empfängt bekommen alle Teilnehmer*innen diese.
      </li>
      <li>
        Um sich zum Empfang von Mitteilungen anzumelden muss nur eine Signal Nachricht mit dem Inhalt "HALLO", "HELLO", "HOLA" oder "ALLÔ" an diese Telefonnummer geschickt werden. Zum Abmelden reicht eine Nachricht mit dem Inhalt "TSCHÜSS", "GOODBYE", "ADIÓS" oder "ADIEU."
      </li>
      <li>
        Signalboost spricht Deutsch, Englisch, Französisch und Spanisch und alle können frei wählen welche Sprache sie für Befehle und Benachrichtigungen nutzen möchten. Mit einer Nachricht die "HILFE" sagt können alle gültigen Befehle abgefragt werden.
      </li>
      <li>
        Der Kanal kann in eine Hotline umgewandelt werden indem du eine Nachricht mit dem Text "HOTLINE AN" an die Kanalnummer schickst.
      </li>
    </ul>

    <h1>Noch Fragen?</h1>
    <ul>
      <li>
        Schick uns eine Signal Nachricht an{' '}
        <span style={{ color: '#bd93f9' }}>+1-938-444-8536</span>
      </li>
      <li>
        Schick uns eine eMail an{' '}
        <a href="mailto:team-friendo@protonmail.com">
          team-friendo@protonmail.com
        </a>{' '}
        oder <a href="mailto:team-friendo@riseup.net">team-friendo@riseup.net</a>
      </li>
      <li>
        Unseren{' '}
        <a href="http://keys.gnupg.net/pks/lookup?search=0xE726A156229F56F1&fingerprint=on&op=index">
          PGP Schlüssel gibts hier
        </a>
      </li>
      <li>
        Besuche uns auf unserer&nbsp;
        <a href="https://0xacab.org/team-friendo/signalboost">gitlab Seite</a>
        &nbsp;um mehr technische Details oder den Quellcode nachzulesen, neue Funktionen vorzuschlagen, Fehler zu melden oder mitzuhelfen!
      </li>
    </ul>
  </Layout>
)

export default IndexPage
