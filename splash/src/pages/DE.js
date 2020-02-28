import React from 'react'
import { Link } from 'gatsby'

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
    <h1>FAQ</h1>
    <ul>
    	<li>
			<a href="#why">Warum sollte ich Signalboost benutzen?</a><br/>
		</li>
		<li>
			<a href="#security">Wie schützt Signalboost meine Telefonnummer und Identität?</a>
		</li>
		
		<li>
			<a href="#secure">Wie sichert Signalboost meine Nachrichten?</a>
		</li>
		<li>
			<a href="#signal">Brauche ich Signal um einen Signalboost Kanal nutzen zu können?</a>
		</li>
		<li>
			<a href="#costl">Was kostet es Signalboost zu nutzen?</a>
		</li>
		<li>
			<a href="#vouche">Können wir kontrollieren wer sich für unseren Kanal anmeldet?</a>
		</li>
		<li>
			<a href="#opensource">Wer ist die Eigentümer*in von Signalboost? Ist Signalboost open-source? Wer hat euch bezahlt Signalboost zu machen?</a>
		</li>
		<li>
			<a href="#listshare">Kann ich eine Liste der Teilnehmer*innen auf meinem Signalboost Kanal einsehen?</a> 
		</li>
		<li>
			<a href="#listshare">Kann ich einen Signalboost Kanal auf dem teamfriendo server bekommen?</a> 
		</li>	    			
	</ul>
    
    <h3><span name="why" class="anchor"></span>Warum sollte ich Signalboost benutzen?</h3>
    <p>
    	Signalboost solltest du benutzen wenn du die hohen Kosten durch SMS Verteiler vermeiden möchtest und du oder deine Community bereits die sichere Nachrichtenapp Signal nutzt. 					Mit Signalboost kannst du auf Signal zurückgreifen um Nachrichten an große Gruppen anderer Signalnutzer*innen zu senden ohne dabei ihre Telefonnummern (die oft eine sehr persönliche und identifizierbare Information ist) allen anderen Gruppenteilnehmer*innen preiszugeben.				Prinzipiell ist Signalboost wie eine Sms-Schleuder die über Signal gesichert ist.
    </p>
    <h3><span name="security" class="anchor"></span>Wie schützt Signalboost meine Telefonnummer und Identität?</h3>
    <p>
    	Signalboost schützt deine Identität indem es deine Telefonnummer vor anderen Teilnehmer*innen des Kanals verbirgt. Selbst Admins können niemals die Telefonnummern der Kanal-Teilnehmer*innen einsehen. Nur der Signalboost Server und seine Maintainer*innen haben Zugriff auf die Nummern der Teilnehmer*innen der einzelnen Kanäle es ist also sehr wichtig, dass sie sich dazu verpflichten diese Informationen zu beschützen.
 
    </p>
    <h3><span name="secure" class="anchor"></span>Wie sichert Signalboost meine Nachrichten? </h3>
    <p>
    	Genau wie dein Telefon und alle mit denen du über Signal kommunizierst, nutzt Signalboost Verschlüsselung um sicherzustellen dass nur die gewünschten Empfänger*innen die Nachricht lesen können. Da der Signalboostserver jedoch in der Praxis ein Empfänger ist, muss er die Nachricht entschlüsseln um sie dann an deinen Kanal weitergeben zu können. Sollte ein Signalboostserver kompromitiert werden könnten Nachrichten die er entschlüsselt also genau so wie bei einem kompromitierten Telefon ausgelesen werden. Im Gegensatz zu jedem Telefon behält Signalboost aber keine Kopie der Nachrichten die es sendet oder empfängt. Die Nachrichten werden, sobald sie weitergeleitet wurden gelöscht, egal was passiert.
	</p>
    <h3><span name="signal" class="anchor"></span>Brauche ich Signal um einen Signalboost Kanal nutzen zu können?</h3>
    <p>
    	Ja. Alle Teilnehmer*innen an einem Signalboost Kanal müssen Signal benutzen. Signal stellt sowohl die Verschlüsselung, als auch den Auslieferungsmechanismus für deine Signalboost Nachrichten.

    <h3><span name="cost" class="anchor"></span>Was kostet es Signalboost zu nutzen?</h3>
    <p>
    	Signalboost ist freie Software und der Signalboost Server von teamfriendo ist frei zur Benutzung durch Communities und Oraganisationen die wir unterstützen wollen.
Es steht allen frei einen Signalboost Server zu hosten und andere Maintainer könnten dafür Gebühren verlangen. Im Gegensatz zu vielen anderen Messaging Apps sind mit dem Versenden von Nachrichten keine Kosten verbunden, da es zum Nachrichtenversand auf Signal zurückfreift statt auf kostspielige SMS-Netzwerke.
    </p>
    <h3><span name="vouche" class="anchor"></span>Können wir kontrollieren wer sich für unseren Kanal anmeldet?</h3>
	<p>
		Ja! Signalboost hat einen "Vertrauen" Modus. Ist dieser aktiviert braucht es entweder eine Einladung eines Admins oder einer anderen Teilnehmer*in um einem Kanal beitreten zu können.
	</p>
	<h3><span name="opensource" class="anchor"></span>Wer ist die Eigentümer*in von Signalboost? Ist Signalboost open-source? Wer hat euch bezahlt Signalboost zu machen?</h3> 
	<p>
		Signalboost ist open-source und steht zur freien Benutzung bereit. Einjeder.m mit dem Können und Willen einen eigenen Signalboost Server mit unserer Software aufzusetzen steht es frei das zu tun. Signalboost wurde zum größten Teil ohne direkte Finanzierung geschrieben, aus Liebe.<br />
		<a href="https://0xacab.org/team-friendo/signalboost">Hier kannst du den Signalboost Quellcode einsehen und lernen wie du eine eigene Instanz aufsetzen kannst &#8680;</a>
	</p>
	<h3><span name="listshare" class="anchor"></span>Kann ich eine Liste der Teilnehmer*innen auf meinem Signalboost Kanal einsehen?</h3>
	<p>
		Nein. Das ist ein grundlegendes Feature von Signalboost. Die Nummern von Teilnehmer*innen sind weder von anderen Teilnehmer*innen noch von Admins des Kanals einsehbar. Nur Signalboost Server Maintainer können diese Daten einsehen, ihnen must du also vertrauen. Im Falle von teamfriendo verbietet es unsere Datenschutzrichtlinie diese Daten jemals preiszugeben oder mit irgendwem zu teilen. 
 
	</p>
	<h3><span name="listshare" class="anchor"></span>Can I pay you to add a feature to Signalboost?</h3>
	<p>
		Vielleicht. Wenn wir es als eine sinnvolle funktionale Erweiterung für die Gruppen denen wir Helfen wollen ansehen, sind wir einem zusätzlichen Anreiz gegenüber nicht abgeneigt. Du kannst den Quellcode auch abspalten und hinzufügen was du möchtest (solange das Resultat Open Source bleibt) oder bei uns mitwirken. <br />
		<a href="mailto:team-friendo@riseup.net">Schick uns eine Email, wenn du mehr über eine Idee sprechen möchtest &#8680;</a>
	</p>
	<h3><span name="teamfriendo" class="anchor"></span>Kann ich einen Signalboost Kanal auf dem teamfriendo server bekommen?</h3>
	<p>
		Signalboost ist in einem limitierten beta Lauf und in aktiver Entwicklung. Zur Zeit stellen wir keine Kanäle auf unserer Instanz öffentlich zur Verfügung. Wenn du gerne zu unserem eingeschränkten beta Programm hinzustoßen möchtest kannst du gerne versuchen uns eine <a href="mailto:team-friendo@riseup.net">eMail</a> mit deinen Bedürfnissen zu schicken. Es kann gut sein, dass wir dir nicht antworten da unser Fokus auf der Entwicklung liegt damit wir bald aus dem beta Lauf raus kommen! 
	</p>
  </Layout>
)

export default IndexPage
