import React from 'react'
import Layout from '../components/Layout'
import { Link } from 'gatsby'

export default () => (
  <Layout>
    <p>
      Diese Seite richtet sich primär an Admins die bereits einen Signalboost Kanal haben. Wenn du einen Kanal brauchst schau mal in den{' '} <Link to="/">Getting Started</Link> Abschnitt. Wenn du mehr über Signalboost und darüber wie sicher die Benutzung ist erfahlen möchtest, wirf einen Blick ins{' '}
      <Link to="/faq">FAQ's.</Link>
    </p>
    <h3>Konzept Übersicht</h3>
    <p>
	Ein Signalboost Kanal hat Admins und Teilnehmer*innen.
	 Wenn ein Admin eine Nachricht an den Kanal schickt, wird diese entweder als Befehl interpretiert oder als Meldung.
	 Ist die Nachricht eine Meldung, wird sie an alle Teilnehmer*innen weitergeleitet - wobei als Absender stets die Signalnummer des Kanals angezeigt wird, nicht dem Admin der sie geschickt hat.
    </p>
<h3>Was ist ein Befehl?</h3>
    <p>
      Ein Befehl ist ein Wort oder eine Phrase die Signalboost als Anweisung interpretiert. Um einen Befehl zu nutzen musst du garnichts kompliziertes tun - schreibe ihn einfach in den Kanal und Signalboost wird ihn interpretieren oder eine Fehlermeldung ausgeben! Einige Befehle können nur von Admins ausgeführt werden. Wenn du dir nicht sicher bist welcher Befehl der Richtige ist, dann ist HILFE immer ein guter Anfang.
    </p>
    <p>
      Signalboost unterstützt zur Zeit Englisch, Spanisch, Französich und Deutsch. Um in deine Wahlsprache zu wechseln kannst du einfach den Namen der Sprache in den Kanal tippen. Wenn ich zum Beispiel meine Spracheinstellung auf Spanisch umstellen möchte, würde ich "ESPAÑOL" an den Kanal senden.
    </p>

    <h2>Verschwindende Nachrichten</h2>
    <p>
      Von Haus aus verschwinden die Nachrichten auf allen Signalboost Kanälen nach einer Woche. Aber Admins (und nur Admins) können über den Timer für verschwindende Nachrichten in der oberen rechten Ecke der Signal app, die 1-Wochen Periode umstellen.
    </p>

    <h2>Admin Befehle</h2>
    <h4>HILFE</h4>
    <p>-> Zeigt alle Befehle die du nutzen kannst an</p>

    <h4>INFO</h4>
    <p>-> Zeigt einige statistische Infos über den Kanal, und erklärt in Kurzform wie Signalboost funktioniert</p>

    <h4>HINZUFÜGEN / ENTFERNEN +491701234567</h4>
    <p>-> Fügt +491701234567 hinzu, oder entfernt diese als Admin des Kanals. Jede.r Admin kann andere als Admin hinzufügen oder entfernen</p>

    <h4>EINLADEN +491701234567</h4>
    <p>-> Lädt +491701234567 ein sich beim Kanal anzumelden. Nicht vergessen die Telefonnummer mit einem + und dem Ländercode zu beginnen</p>

    <h4>HOTLINE AN / AUS</h4>
    <p>-> Schaltet die Hotline Funktion an oder aus. Das bedeutet, dass Teilnehmer*innen dem Kanal schreiben können und die Nachricht anonym den Admins weitergeleitet wird. In der Standarteinstellung starten Signalboost Kanäle mit ausgeschalteter Hotline Funktion. Wenn du ein Admin bist, kannst du einer Nachricht ansehen, dass sie eine Hotline Nachrciht ist weil sie mit folgender Kopfzeile beginnt:</p>
  <p>
      <b>[HOTLINE MESSAGE]</b>
    </p>
    <p>
      Wenn die Hotline eingeschaltet wird: 
	<ul>
	<li>Bleibt die Anonymität der Teilnehmer*innen gewahrt.</li>
	<li>
	  Das bedeutet, dass Teilnehmer*innen ihre Nummer in die Nachricht schreiben müssen wenn sie in Kontakt mit einem der Admins treten wollen.
	</li>
	<li>
	  Jenachdem wie viele Personen am Kanal teilnehmen, kann die Hotline sehr gesprächig sein und erhöht die Warscheinlichkeit für Spam und Missbrauch
	</li>
      </ul>
    </p>

    <h4>ESPAÑOL / FRANÇAIS / ENLISH</h4>
    <p>-> Stellt die Sprache auf Spanisch, Französisch oder Englisch um. Spracheinstellungen für Signalboost sind Nutzerspezifisch du musst dir damit also keine Sorgen um andere machen. 
    </p>

    <h4>UMBENENNEN neuer name</h4>
    <p>
	Benennt den Kanal in "neuer name" um</p>
    <p>Beispiel: UMBENENNEN Mein Kooler Signalboost Kanal</p>

    <h4>BESCHREIBUNG beschreibung des kanals</h4>
    <p>
	Fügt eine öffentliche Beschreibung des Kanals hinzu oder erneuert diese</p>

    <h4>VERTRAUEN AN / AUS</h4>
    <p>
	Wenn Vertrauen angeschaltet ist können nur Personen die eine Einladung über den EINLADEN Befehl erhalten haben dem Kanal als Teilnehmer*in beitreten. Einladungen bleiben gültig auch wenn Vertrauen mehrfach an- und ausgeschaltet wird
    </p>

    <h4>VERTRAUENS-LEVEL level</h4>
    <p>
	Verändert die Zahl der benötigten Einladungen um dem Kanal beitreten zu können; zur Zeit kann das auf eine Zahl zwischen 1 und 10 gestellt werden.
    </p>


    <h4>TSCHÜSS</h4>
    <p>
	Entfernt dich aus diesem Kanal. Falls du ein Admin bist verlierst du damit den Admin Zugang zum Kanal kannst aber weiter als Teilnehmer*in beitreten. Möchtest du wieder als Admin hinzugefügt werden, musst du eine.n existenten Admin darum bitten dich mit dem HINZUFÜGEN Befehl als Admin hinzuzufügen.
    </p>

    <h4>VERNICHTEN</h4>
    <p>
	VORSICHT! Dieser Befehl löscht den Kanal und alle zugehörigen Daten unwiderruflich. Achtung, der Nachrichtenverlauf auf den Admin und Teilnehmer*innen Telefonen bleibt bis der Timer für verschwindende Nachrichten abgelaufen ist erhalten!
    </p>
  </Layout>
)
